export const cppMemoryModel = { name: "Memory Model & Atomics", lessons: [
  {
    id: "cpp-adv-mm-happens-before",
    title: "Happens-Before & Sequential Consistency",
    difficulty: "Staff",
    icon: "⏰",
    description:
      "Multithreaded programs are only correct if you reason about ORDERING between threads. The C++ memory model defines happens-before: a partial order across operations on different threads, established by synchronizing actions (mutex, atomic with the right ordering, thread spawn/join). 'Sequentially consistent' is the strongest, simplest mental model — and the default for std::atomic.",
    concepts: [
      "Sequence-before (within a thread)",
      "Synchronizes-with across threads",
      "Happens-before = sequence + synchronizes",
      "Data race = no happens-before between conflicting accesses",
      "memory_order_seq_cst as the default",
    ],
    bridges: {
      Java: "Java has the same happens-before formalism. volatile in Java ≈ memory_order_seq_cst.",
      Rust: "Rust's std::sync::atomic uses the same orderings (with safer defaults).",
      Go: "Go has its own happens-before doc; channels and sync primitives are the synchronization edges.",
    },
    code: `#include <atomic>
#include <thread>
#include <iostream>
#include <cassert>

// SEQUENTIAL CONSISTENCY — easy to reason about, costliest.
// Every seq_cst load/store participates in ONE total order observed by all threads.

std::atomic<bool> ready{false};
int payload = 0;

void producer() {
    payload = 42;                         // (A) non-atomic write
    ready.store(true);                    // (B) seq_cst (default)
}
void consumer() {
    while (!ready.load()) {}              // (C) seq_cst (default)
    assert(payload == 42);                // (D) — guaranteed to see 42
}

// Why this works:
//   (A) is sequence-before (B) — same thread.
//   (B) synchronizes-with (C) — B's store seen by C's load via seq_cst.
//   (C) is sequence-before (D).
// Transitively: (A) happens-before (D). No data race; (D) reads 42.

// WITHOUT atomic on \`ready\`:
//   bool ready = false;                  // plain
//   payload = 42; ready = true;          // compiler may reorder these
//   while (!ready) {}                    // compiler may hoist this
//   payload                              // UNDEFINED — data race
// The data race is UB even if it "seems to work" — compiler can assume no race.

// THE HAPPENS-BEFORE LATTICE.
// Edges that create happens-before across threads:
//   - mutex::unlock() in thread T1, then mutex::lock() in T2.
//   - atomic with release in T1, atomic with acquire in T2 (same variable).
//   - thread::join() and the joined thread's body.
//   - thread::~thread() and any operation in the started thread (for spawn).
//   - condition_variable::notify and wake-up.

// DATA RACE is UB — even if "harmless".
int counter_plain = 0;
void bad_inc() {
    for (int i = 0; i < 1000; ++i) counter_plain++;   // race: read-modify-write
    // Lost updates are NOT the only problem. Compiler can hoist, vectorize,
    // assume non-racy. End result: anything is possible.
}

// MENTAL MODEL: when in doubt, use mutexes or seq_cst atomics.
// Reach for weaker orderings only with measured profile and clear proof of correctness.\`,
    seedQuestions: [
      "What constitutes a 'synchronizes-with' edge between two threads?",
      "Why is a data race undefined behavior even if 'no one cares' about the lost updates?",
      "How does the happens-before relation transitively get the consumer to see payload == 42?",
      "What's the cost difference between seq_cst and weaker orderings on modern hardware?",
    ],
  },
  {
    id: "cpp-adv-mm-acquire-release",
    title: "Acquire/Release Semantics",
    difficulty: "Staff",
    icon: "🤝",
    description:
      "Release/acquire is the workhorse pairing for lock-free programming. A release-store 'publishes' all prior writes; an acquire-load 'subscribes' to them. Together they establish happens-before WITHOUT the global ordering cost of seq_cst. The model maps cleanly to ARM, POWER, and x86's somewhat-stronger reality.",
    concepts: [
      "memory_order_acquire / release / acq_rel",
      "Release-store + acquire-load handshake",
      "What can/cannot be reordered around acq/rel",
      "compare_exchange weak vs strong",
      "Cost vs seq_cst on x86, ARM",
    ],
    bridges: {
      Rust: "Rust's Ordering enum mirrors this. Ordering::Acquire and Ordering::Release behave identically.",
      Java: "Java has VarHandle::setRelease, ::getAcquire (since Java 9).",
      C11: "C11 stdatomic.h has the same memory_order enum.",
    },
    code: \`#include <atomic>
#include <thread>
#include <iostream>

// PATTERN: publish a fully-constructed object via release-store, consume via acquire-load.
struct Config { int retries; int timeout_ms; };
std::atomic<Config*> g_config{nullptr};

void init() {
    auto* c = new Config{3, 100};                              // construct first
    g_config.store(c, std::memory_order_release);              // publish — release ensures
                                                               // Config writes happen-before this store.
}

void use() {
    Config* c = g_config.load(std::memory_order_acquire);      // subscribe
    if (c) {
        // ACQUIRE pairs with RELEASE → we see all of init()'s writes.
        std::cout << c->retries << ' ' << c->timeout_ms;
    }
}

// WHAT REORDERING IS PREVENTED:
//   - Before a release-store: writes cannot move PAST it (down).
//   - After  an acquire-load: reads/writes cannot move BEFORE it (up).
//   - Compiler and hardware respect these.

// SEQ_CST is acq+rel + a global total order.
// Acquire/release is cheaper because no global ordering is forced.

// ATOMIC FLAG SPINLOCK (educational; std::mutex is usually better).
class SpinLock {
    std::atomic<bool> locked_{false};
public:
    void lock() {
        bool expected = false;
        while (!locked_.compare_exchange_weak(expected, true,
                                              std::memory_order_acquire,
                                              std::memory_order_relaxed)) {
            expected = false;          // CAS may spuriously fail; reset
            std::this_thread::yield();
        }
    }
    void unlock() {
        locked_.store(false, std::memory_order_release);
    }
};

// compare_exchange weak vs strong.
//   weak   — allowed to fail spuriously; pair with a loop. Cheaper on ARM/POWER.
//   strong — only fails if the expected value was wrong. Use for single-attempt CAS.

// COSTS on common hardware (approximation):
//   x86 / x86_64:
//     - Acquire-load ≈ regular load (TSO is naturally acq).
//     - Release-store ≈ regular store.
//     - seq_cst store: full mfence — costly.
//   ARM / AArch64:
//     - Acquire/release: dedicated load-acquire / store-release ops.
//     - seq_cst: stronger barriers, distinctly more expensive.
// LESSON: on ARM in particular, choosing acquire/release over seq_cst can be a big win.\`,
    seedQuestions: [
      "What does release-then-acquire establish that two relaxed accesses do not?",
      "Why is compare_exchange_weak cheaper than _strong on some hardware?",
      "How does x86's TSO model make seq_cst loads almost free but seq_cst stores expensive?",
      "Where in the SpinLock would using seq_cst instead of acq/rel be functionally correct but slower?",
    ],
  },
  {
    id: "cpp-adv-mm-relaxed",
    title: "Relaxed Ordering & Atomic Fences",
    difficulty: "Staff",
    icon: "🌊",
    description:
      "memory_order_relaxed: atomic operations with no synchronization, only atomicity. Useful for counters, statistics, and as building blocks paired with explicit \`std::atomic_thread_fence\`. Get it wrong and your 'optimization' becomes a Heisenbug. The intuition: relaxed = 'I just want it to be tear-free'.",
    concepts: [
      "Relaxed: atomic but unsynchronized",
      "fetch_add for counters",
      "Standalone fences for fine-grained control",
      "Independent reads of independent writes (IRIW)",
      "When relaxed is safe",
    ],
    bridges: {
      Java: "Java's Atomic*::getAndAdd has acquire/release semantics by default; Java's relaxed is via VarHandle::getOpaque/setOpaque.",
      Rust: "Ordering::Relaxed maps directly.",
      Go: "atomic.AddInt64 etc.; ordering is unspecified — closer to seq_cst.",
    },
    code: \`#include <atomic>
#include <thread>
#include <vector>
#include <iostream>

// RELAXED COUNTERS — classic safe use.
std::atomic<long> stat_requests{0};
void on_request() {
    stat_requests.fetch_add(1, std::memory_order_relaxed);
    // No happens-before needed: nobody DEPENDS on ordering relative to other operations.
}
// Reading it elsewhere: same memory_order_relaxed. May be slightly stale; that's fine.

// RELAXED IS WRONG when you need to PUBLISH data:
std::atomic<int*> shared{nullptr};
void publish_BAD() {
    int* p = new int(42);
    shared.store(p, std::memory_order_relaxed);   // BUG: other thread may see p before *p=42
}
// Fix: release.
void publish_OK() {
    int* p = new int(42);
    shared.store(p, std::memory_order_release);
}

// FENCES — explicit ordering between non-atomic and atomic accesses, or
// between two atomic ops, without making each load/store a special kind.
std::atomic<bool> flag{false};
int data = 0;

void producer() {
    data = 1;
    std::atomic_thread_fence(std::memory_order_release);
    flag.store(true, std::memory_order_relaxed);  // relaxed store + prior fence ≈ release
}
void consumer() {
    while (!flag.load(std::memory_order_relaxed)) {}
    std::atomic_thread_fence(std::memory_order_acquire);
    // From here, data == 1 is guaranteed.
    std::cout << data;
}
// Fence form is useful when one fence serves multiple atomics.

// INDEPENDENT READS OF INDEPENDENT WRITES (IRIW).
// Two threads write to X and Y; two other threads read both. With relaxed,
// the readers may observe the writes in DIFFERENT orders. seq_cst forbids this.
//
//   T1: x.store(1, relaxed);
//   T2: y.store(1, relaxed);
//   T3: reads x then y    — may see (1, 0)
//   T4: reads y then x    — may see (1, 0)
//   With seq_cst: a global total order forbids this combination.

// WHEN RELAXED IS SAFE:
//   - Independent counters that no other invariant depends on.
//   - The variable's value is the only data that crosses threads.
//   - You explicitly add fences for any happens-before you need.

// GOLDEN RULE: start with seq_cst, profile, drop to acquire/release with rationale,
// and only use relaxed/fences when you can write down the happens-before story exactly.\`,
    seedQuestions: [
      "Why is publishing a pointer with relaxed ordering broken?",
      "How does a release fence paired with a relaxed store approximate a release-store?",
      "What's the IRIW puzzle, and why does seq_cst rule it out?",
      "Give two examples where memory_order_relaxed is the right choice.",
    ],
  },
  {
    id: "cpp-adv-mm-lockfree",
    title: "Lock-Free Patterns: Treiber Stack",
    difficulty: "Staff",
    icon: "⛓️",
    description:
      "A walk-through of the Treiber stack: the canonical lock-free data structure built from compare-and-swap. We'll cover the ABA problem, why hazard pointers exist, and the practical reality that lock-free is rarely a performance win unless your workload truly contends. Most real systems pick fine-grained locking.",
    concepts: [
      "compare_exchange_weak in a CAS loop",
      "The ABA problem",
      "Hazard pointers / RCU sketch",
      "Lock-free is not wait-free",
      "When lock-free actually wins (and when it loses)",
    ],
    bridges: {
      Rust: "crossbeam crate ships proven lock-free queues/stacks with epoch-based reclamation.",
      Java: "java.util.concurrent has ConcurrentLinkedQueue (Michael-Scott queue) built on CAS.",
      C: "Liblfds and similar; same ideas, no destructors complicating cleanup.",
    },
    code: \`#include <atomic>
#include <memory>

// TREIBER STACK — push and pop via CAS on the head pointer.
template <typename T>
class TreiberStack {
    struct Node { T value; Node* next; };
    std::atomic<Node*> head_{nullptr};

public:
    void push(T v) {
        Node* n = new Node{std::move(v), head_.load(std::memory_order_relaxed)};
        while (!head_.compare_exchange_weak(n->next, n,
                                            std::memory_order_release,
                                            std::memory_order_relaxed)) {
            // n->next is updated to the current head; loop retries.
        }
    }

    // POP returns false if empty. Note the ABA hazard.
    bool pop(T& out) {
        Node* old = head_.load(std::memory_order_acquire);
        while (old &&
               !head_.compare_exchange_weak(old, old->next,
                                            std::memory_order_acquire,
                                            std::memory_order_relaxed)) {
            // retry with refreshed \`old\`
        }
        if (!old) return false;
        out = std::move(old->value);
        delete old;                  // ⚠️ unsafe under concurrent readers (use-after-free)
        return true;
    }
};

// THE ABA PROBLEM (illustrative).
//   Thread T1 reads head = A. Plans CAS(A → A->next).
//   Thread T2 pops A, pushes B, pops B, pushes A again (potentially recycled).
//   Now head is A again, but A->next may have changed.
//   T1's CAS succeeds — but it now publishes a stale next pointer.
// Detection: pointer + ABA tag (double-width CAS). Reclamation: hazard pointers or epoch RCU.

// HAZARD POINTERS (sketch):
//   Each thread publishes the pointer it's about to dereference.
//   When you'd delete a node, scan all threads' hazard pointers first.
//   If none holds your node, delete; else defer.
// Reduces memory reclamation correctness to a per-thread publish-and-scan.

// LOCK-FREE ≠ WAIT-FREE.
//   Lock-free: at least ONE thread makes progress.
//   Wait-free: EVERY thread makes progress in bounded steps.
//   Most "lock-free" code is just CAS loops — under contention each thread retries.

// PERFORMANCE REALITY.
//   - High contention: lock-free can WIN over coarse locks.
//   - Low contention: a normal std::mutex is often faster (uncontested mutex ≈ 20-50 ns).
//   - Mixed read/write: try a reader-writer lock or sharded data structures first.
//   - Reclamation overhead frequently dominates the "free" in lock-free.

// PRACTICAL: use a battle-tested library (folly, moodycamel ConcurrentQueue,
// tbb concurrent containers). Rolling your own is a research project.\`,
    seedQuestions: [
      "Walk through how the ABA problem can corrupt a Treiber stack — what gets wrong?",
      "Why is the \`delete old;\` line in pop a hazard, and what fixes it?",
      "What's the difference between lock-free and wait-free, and which is what most CAS-loop algorithms achieve?",
      "When does a plain std::mutex outperform a hand-rolled lock-free structure?",
    ],
  },
] };
