#!/usr/bin/env python3
"""
Train the Line Reference Validator as a LISTWISE ranker.

Each reference is one "query group" — the candidate lines in the file are the
"documents". The ranker is trained to score the actual correct line above all
others within the group, via softmax cross-entropy (rank_xendcg). At inference
the validator simply takes argmax of scores across the candidate set; both
DETECT_T and ACCEPT_MARGIN are gone.

Usage:
    python train_model.py
"""

import csv
import pickle
import sys
from pathlib import Path

import numpy as np
from lightgbm import LGBMRanker

DATA_DIR = Path(__file__).parent / "data"

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from validator import FEATURE_NAMES  # noqa: E402


def load_csv(path):
    """Load feature CSV and compute group sizes by consecutive (entry_id, ref_raw)."""
    rows = list(csv.DictReader(open(path)))
    X = np.array([[float(r[f]) for f in FEATURE_NAMES] for r in rows], dtype=float)
    y = np.array([int(r["is_correct"]) for r in rows], dtype=int)
    meta = [(r["entry_id"], r["ref_raw"]) for r in rows]

    groups = []
    if meta:
        cur_key = meta[0]
        run = 1
        for k in meta[1:]:
            if k == cur_key:
                run += 1
            else:
                groups.append(run)
                cur_key = k
                run = 1
        groups.append(run)
    assert sum(groups) == len(meta), "group sizes must sum to row count"
    return X, y, np.array(groups), meta


def per_group_accuracy(model, X, y, groups, meta):
    """For each group: does argmax(score) land on the row labelled is_correct=1?"""
    scores = model.predict(X)
    correct = 0
    total = 0
    noop_correct = 0
    noop_total = 0
    fix_correct = 0
    fix_total = 0
    i = 0
    for g in groups:
        sl = slice(i, i + g)
        i += g
        labels = y[sl]
        if labels.sum() != 1:
            continue  # only score groups with exactly one positive
        total += 1
        pred = int(np.argmax(scores[sl]))
        gold = int(np.argmax(labels))
        # No-op group: the LLM's claim IS the correct line. We detect that by
        # locating the row with is_original_claim=1 and checking if it's also
        # the gold row.
        is_orig_col = FEATURE_NAMES.index("is_original_claim")
        claim_idx = int(np.argmax(X[sl, is_orig_col]))
        is_noop = (claim_idx == gold)
        if is_noop:
            noop_total += 1
            if pred == gold:
                noop_correct += 1
        else:
            fix_total += 1
            if pred == gold:
                fix_correct += 1
        if pred == gold:
            correct += 1
    return {
        "overall": (correct, total),
        "noop": (noop_correct, noop_total),
        "fix": (fix_correct, fix_total),
    }


def main():
    print("Loading data...")
    X_tr, y_tr, g_tr, m_tr = load_csv(DATA_DIR / "features_train.csv")
    X_va, y_va, g_va, m_va = load_csv(DATA_DIR / "features_validation.csv")
    print(f"  train: {len(y_tr)} rows in {len(g_tr)} groups, positives={int(y_tr.sum())}")
    print(f"  val:   {len(y_va)} rows in {len(g_va)} groups, positives={int(y_va.sum())}")

    print("\nTraining LGBMRanker (rank_xendcg)...")
    # Regularisation comes from leaf size + bagging, not early stopping —
    # the 28-group validation set's NDCG is too noisy to gate iterations on.
    model = LGBMRanker(
        objective="rank_xendcg",
        n_estimators=300,
        learning_rate=0.05,
        num_leaves=15,
        min_data_in_leaf=15,
        feature_fraction=0.7,
        bagging_fraction=0.8,
        bagging_freq=5,
        random_state=42,
        verbosity=-1,
    )
    model.fit(X_tr, y_tr, group=g_tr)

    print("\n== Per-group ranking accuracy (argmax of scores) ==")
    for name, (X, y, g, m) in [("train", (X_tr, y_tr, g_tr, m_tr)),
                                ("val",   (X_va, y_va, g_va, m_va))]:
        r = per_group_accuracy(model, X, y, g, m)
        oc, ot = r["overall"]
        nc, nt = r["noop"]
        fc, ft = r["fix"]
        pct = lambda c, t: f"{c}/{t} ({c*100//max(t,1)}%)"
        print(f"  {name:5s}  overall={pct(oc,ot)}  "
              f"no-op={pct(nc,nt)}  fix={pct(fc,ft)}")

    print("\n== Feature importance ==")
    imp = model.feature_importances_
    order = np.argsort(imp)[::-1]
    total = imp.sum() if imp.sum() > 0 else 1
    for idx in order:
        share = imp[idx] / total
        bar = "#" * int(share * 50)
        print(f"  {FEATURE_NAMES[idx]:28s} {share:.3f}  {bar}")

    model_path = DATA_DIR / "validator_model.pkl"
    with open(model_path, "wb") as f:
        pickle.dump({
            "model": model,
            "scaler": None,
            "model_name": "LGBMRanker_rank_xendcg",
            "features": FEATURE_NAMES,
        }, f)
    print(f"\nSaved {model_path}")


if __name__ == "__main__":
    main()
