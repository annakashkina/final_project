export const cppConcurrency = { name: "Modern Concurrency", lessons: [
  {
    id: "cpp-adv-jthread",
    title: "jthread, stop_token & Cancellation",
    difficulty: "Advanced",
    icon: "🛑",
    description:
      "`std::jthread` (C++20) is `std::thread` with two key improvements: it joins automatically in its destructor, and it supports cooperative cancellation via `std::stop_token`. The pair gives you safe, structured concurrency primitives — no more 'forgot to join' bugs, no more raw flag-based cancellation.",
    concepts: [
      "jthread RAII join behavior",
      "stop_token: cooperative cancellation",
      "stop_callback for resource cleanup on cancel",
      "request_stop semantics",
      "Why std::thread::terminate-on-destruct is gone",
    ],
    bridges: {
      Rust: "Rust's std::thread::spawn returns a JoinHandle; tokio offers cancellation tokens.",
      Go: "Goroutines + context.Context — exactly the same cancellation pattern.",
      Java: "Thread.interrupt() is the cooperative cancellation model; jthread + stop_token mirrors it.",
    },
    code: `#include <thread>
#include <stop_token>
#include <chrono>
#include <iostream>

void worker(std::stop_token st) {
    while (!st.stop_requested()) {
        // do a chunk of work
        std::this_thread::sleep_for(std::chrono::milliseconds(50));
    }
    std::cout << "worker exiting cleanly\\n";
}

void demo() {
    {
        std::jthread t(worker);              // stop_token threaded automatically
        std::this_thread::sleep_for(std::chrono::milliseconds(200));
        // No explicit join; jthread destructor calls request_stop() then join().
    }
    // After scope: thread joined.
}

// MANUAL request_stop.
void demo_manual() {
    std::jthread t([](std::stop_token st) {
        while (!st.stop_requested()) { /* work */ }
    });
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
    t.request_stop();                        // signal cancel
    // dtor joins.
}

// STOP_CALLBACK — fires when stop is requested. Wakes blocking I/O, etc.
void wait_with_cancel(std::stop_token st) {
    std::condition_variable_any cv;
    std::mutex m;
    std::unique_lock lk(m);

    // When stop is requested, notify the cv so wait() returns.
    std::stop_callback cb(st, [&] { cv.notify_all(); });

    cv.wait(lk, [&]{ return st.stop_requested() || /* data ready */ false; });
}

// stop_source — when you want to share cancellation across many threads.
void multi_worker() {
    std::stop_source src;
    std::vector<std::jthread> workers;
    for (int i = 0; i < 4; ++i) {
        workers.emplace_back([tok = src.get_token(), i](std::stop_token) {
            while (!tok.stop_requested()) { /* shard i work */ }
        });
    }
    // Time passes; we decide to cancel ALL workers atomically.
    src.request_stop();
    // jthreads join in destruction order.
}

// LEGACY std::thread surprise: failing to join() called terminate().
// jthread fixes this by always joining — no surprise terminate, no leaked thread.\`,
    seedQuestions: [
      "Why is \`std::jthread\` an improvement over \`std::thread\` for safety, not just convenience?",
      "How does stop_callback let you wake a thread that's blocked in cv.wait or read()?",
      "What does \`stop_source\` give you over passing tokens individually?",
      "What's the cancellation model: preemptive or cooperative, and why does that matter for correctness?",
    ],
  },
  {
    id: "cpp-adv-latch-barrier",
    title: "Latches, Barriers, Semaphores",
    difficulty: "Advanced",
    icon: "🚪",
    description:
      "C++20 added three synchronization primitives the standard had been missing: \`std::latch\` (one-shot countdown), \`std::barrier\` (reusable rendezvous point), \`std::counting_semaphore\` (resource permits). They cover the patterns where mutex+cv was overkill — fan-out/fan-in, batch processing rounds, rate-limited workers.",
    concepts: [
      "latch: one-time count-down rendezvous",
      "barrier: reusable phase synchronization",
      "binary_semaphore as a fast mutex alternative",
      "counting_semaphore for resource pools",
      "Comparison with condition_variable",
    ],
    bridges: {
      Java: "CountDownLatch, CyclicBarrier, Semaphore — same names, same semantics.",
      Go: "sync.WaitGroup (latch-like). Channels often replace these patterns.",
      Rust: "tokio::sync::Semaphore; std lacks latch/barrier, crates like 'sync' provide them.",
    },
    code: \`#include <latch>
#include <barrier>
#include <semaphore>
#include <thread>
#include <vector>
#include <chrono>
#include <iostream>

// LATCH — count-down once, threads wait for it to hit zero.
void start_synchronously() {
    std::latch start_gate(1);

    std::vector<std::jthread> runners;
    for (int i = 0; i < 4; ++i) {
        runners.emplace_back([&start_gate, i] {
            start_gate.wait();                    // park until released
            std::cout << "runner " << i << " go\\n";
        });
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
    start_gate.count_down();                       // release everyone at once
}

// FAN-OUT / FAN-IN — use latch as a "join" point too.
void parallel_sum() {
    constexpr int N = 8;
    std::latch done(N);
    std::vector<long> partials(N);
    for (int i = 0; i < N; ++i) {
        std::jthread([&, i] {
            partials[i] = i * 1000;
            done.count_down();
        }).detach();
    }
    done.wait();                                   // until all N have counted down
    // partials now safe to read
}

// BARRIER — reusable, runs a completion function per phase.
void simulation_steps() {
    constexpr int Workers = 4;
    std::barrier sync_point(Workers, [] {
        // optional completion: runs on the last arriver, before the next phase begins.
        std::cout << "phase complete\\n";
    });

    auto step_worker = [&] {
        for (int phase = 0; phase < 3; ++phase) {
            // ... compute this phase ...
            sync_point.arrive_and_wait();          // all workers must reach here
        }
    };
    std::vector<std::jthread> ws;
    for (int i = 0; i < Workers; ++i) ws.emplace_back(step_worker);
}

// COUNTING SEMAPHORE — N concurrent permits.
class ConnectionPool {
    std::counting_semaphore<10> sem_{10};          // max 10 concurrent
public:
    void use() {
        sem_.acquire();                            // blocks if all 10 taken
        // ... use a connection ...
        sem_.release();                            // return permit
    }
};

// BINARY SEMAPHORE — same as counting<1>, useful for very light signaling.
//   Faster than std::mutex on some platforms, no ownership tracking.

// WHEN TO USE WHICH:
//   latch     → one-shot start gate or join. Cannot be reused.
//   barrier   → repeated phases of work. Reusable.
//   semaphore → permits / pool size / rate limiting.
//   mutex+cv  → custom predicates, single-condition signaling.\`,
    seedQuestions: [
      "How does std::latch differ from std::barrier, beyond reusability?",
      "Why is a barrier with a completion function safer than 'last thread does cleanup' patterns?",
      "When is std::counting_semaphore the right tool over std::mutex+cv?",
      "What happens if a barrier has 4 expected arrivals but only 3 threads ever reach it?",
    ],
  },
  {
    id: "cpp-adv-cv-patterns",
    title: "Condition Variable Patterns",
    difficulty: "Advanced",
    icon: "📣",
    description:
      "Condition variables remain the universal tool for 'wait until a predicate holds'. The lambda-overload of \`wait\` handles spurious wake-ups correctly; \`notify_one\` vs \`notify_all\` requires careful thought; missed wake-ups happen when you signal without holding the mutex. Three canonical patterns: bounded queue, future/promise, and shutdown.",
    concepts: [
      "Predicate-based wait (no spurious-wake bugs)",
      "notify_one vs notify_all",
      "Missed-wakeup pitfall",
      "Signaling under the lock vs after",
      "Building a bounded queue",
    ],
    bridges: {
      Java: "Object.wait/notify with synchronized() — same primitives.",
      Rust: "std::sync::Condvar — Mutex must be held; Condvar::wait_while is the predicate form.",
      Python: "threading.Condition — similar API.",
    },
    code: \`#include <condition_variable>
#include <mutex>
#include <queue>
#include <optional>
#include <thread>

// BOUNDED QUEUE — the canonical example.
template <typename T>
class BoundedQueue {
    std::mutex                m_;
    std::condition_variable   not_full_;
    std::condition_variable   not_empty_;
    std::queue<T>             q_;
    std::size_t               cap_;
    bool                      closed_ = false;
public:
    explicit BoundedQueue(std::size_t cap) : cap_(cap) {}

    bool push(T v) {
        std::unique_lock lk(m_);
        not_full_.wait(lk, [&]{ return q_.size() < cap_ || closed_; });
        if (closed_) return false;
        q_.push(std::move(v));
        lk.unlock();                       // unlock BEFORE notify — avoid waking
        not_empty_.notify_one();           //                       and immediately blocking
        return true;
    }

    std::optional<T> pop() {
        std::unique_lock lk(m_);
        not_empty_.wait(lk, [&]{ return !q_.empty() || closed_; });
        if (q_.empty()) return std::nullopt;
        T v = std::move(q_.front()); q_.pop();
        lk.unlock();
        not_full_.notify_one();
        return v;
    }

    void close() {
        { std::lock_guard lk(m_); closed_ = true; }
        not_empty_.notify_all();           // wake EVERY consumer to see closed
        not_full_.notify_all();
    }
};

// PITFALL: missed wake-up.
//
//   Bad sequence:
//     producer:                consumer:
//                              std::unique_lock lk(m);
//                              if (!ready) {
//     ready = true;
//     cv.notify_one();             // signal arrives — no one waiting yet
//                                 cv.wait(lk);     // waits forever
//                              }
//
// FIX: the predicate-form wait re-checks under the lock.
//   cv.wait(lk, []{ return ready; });
//
// This idiom handles BOTH missed wake-ups and spurious wake-ups.

// notify_one vs notify_all:
//   notify_one — wakes exactly one waiter; for symmetric workers, this is the right choice.
//   notify_all — wakes all waiters; needed when the wake-up reason can satisfy several
//                (e.g., "queue closed" — every waiter must observe it).

// LOCKED vs UNLOCKED notify:
//   Calling notify_one() while still holding the mutex is correct but slightly worse:
//   the waker holds the lock the woken thread now wants. Unlock first when possible.\`,
    seedQuestions: [
      "What is the 'missed wake-up' bug, and how does the predicate-form wait prevent it?",
      "When should you reach for notify_all instead of notify_one?",
      "What's the practical reason to unlock the mutex before calling notify?",
      "Why does the close() method notify both condition variables, not just one?",
    ],
  },
] };
