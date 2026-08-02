export const cppProjectThreadpool = { name: "Project: Coroutine Task System", lessons: [
  {
    id: "cpp-adv-tasksystem-pool",
    title: "A Minimal Thread Pool",
    difficulty: "Project",
    icon: "🏭",
    description:
      "Before the coroutine layer, you need an executor: a thread pool that runs work items. The classic design — N workers, a shared queue, condition variable for wake-up. We'll build one, then in the next lesson layer a coroutine task on top so co_await composes with it.",
    concepts: [
      "Bounded thread pool design",
      "Shared work queue with cv signaling",
      "Clean shutdown via stop_token",
      "Future-based result delivery",
      "When to add work stealing",
    ],
    bridges: {
      Rust: "rayon and tokio runtime are production-grade examples. Our pool resembles tokio's basic scheduler.",
      Java: "ExecutorService + ThreadPoolExecutor — same shape.",
      Go: "Goroutines schedule onto an internal M:N pool; user-invisible.",
    },
    files: [
      {
        name: "thread_pool.h",
        code: `#pragma once

#include <thread>
#include <vector>
#include <queue>
#include <mutex>
#include <condition_variable>
#include <future>
#include <functional>
#include <atomic>
#include <stop_token>

class ThreadPool {
    std::vector<std::jthread>      workers_;
    std::queue<std::function<void()>> jobs_;
    std::mutex                     m_;
    std::condition_variable_any    cv_;
    std::stop_source               stop_;

public:
    explicit ThreadPool(std::size_t n = std::thread::hardware_concurrency()) {
        for (std::size_t i = 0; i < n; ++i)
            workers_.emplace_back([this](std::stop_token st) { worker(st); });
    }

    ~ThreadPool() {
        stop_.request_stop();
        cv_.notify_all();
        // jthreads join in their destructors
    }

    // SUBMIT a callable; get a future for its result.
    template <typename F, typename... Args>
    auto submit(F&& f, Args&&... args)
        -> std::future<std::invoke_result_t<F, Args...>>
    {
        using R = std::invoke_result_t<F, Args...>;

        auto task = std::make_shared<std::packaged_task<R()>>(
            std::bind(std::forward<F>(f), std::forward<Args>(args)...)
        );
        auto fut = task->get_future();

        {
            std::lock_guard lk(m_);
            jobs_.emplace([task]{ (*task)(); });
        }
        cv_.notify_one();
        return fut;
    }

    // POST a fire-and-forget job — used by the coroutine layer.
    void post(std::function<void()> job) {
        {
            std::lock_guard lk(m_);
            jobs_.emplace(std::move(job));
        }
        cv_.notify_one();
    }

private:
    void worker(std::stop_token st) {
        while (!st.stop_requested()) {
            std::function<void()> job;
            {
                std::unique_lock lk(m_);
                cv_.wait(lk, [&]{ return st.stop_requested() || !jobs_.empty(); });
                if (st.stop_requested() && jobs_.empty()) return;
                job = std::move(jobs_.front());
                jobs_.pop();
            }
            try {
                job();
            } catch (...) {
                // packaged_task captures exceptions; raw post() ignores them.
            }
        }
    }
};`,
      },
      {
        name: "pool_demo.cpp",
        code: `#include "thread_pool.h"
#include <iostream>
#include <chrono>

int slow_add(int a, int b) {
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
    return a + b;
}

void demo() {
    ThreadPool pool(4);

    // Submit returns a future.
    auto f1 = pool.submit(slow_add, 1, 2);
    auto f2 = pool.submit(slow_add, 3, 4);
    auto f3 = pool.submit([]{ return std::string("hello"); });

    std::cout << f1.get() << ' ' << f2.get() << ' ' << f3.get() << '\\n';

    // Bulk:
    std::vector<std::future<int>> fs;
    for (int i = 0; i < 100; ++i)
        fs.push_back(pool.submit(slow_add, i, i));
    long total = 0;
    for (auto& f : fs) total += f.get();
    std::cout << "sum = " << total << '\\n';
}

// PROFILE & TUNE.
//   - For CPU-bound work: N = hardware_concurrency() (default).
//   - For mixed I/O+CPU: more workers, possibly N * 1.5.
//   - Queue contention dominates for tiny jobs — batch them.
//   - Single global mutex is fine up to a few hundred jobs/sec; beyond that
//     consider per-worker queues with work stealing.

// PRODUCTION GAPS:
//   - No work stealing → load imbalance for skewed tasks.
//   - No priority levels.
//   - Submit can block briefly under contention.
//   - No back-pressure if queue grows unbounded.
//   - No support for cancellation of in-flight tasks.
//
// Real pools (Folly, Asio, libunifex, oneTBB) address all of these.\`,
      },
    ],
    seedQuestions: [
      "Why does \`submit\` wrap the callable in a \`packaged_task\` instead of running it directly?",
      "What does \`cv_.notify_one()\` after enqueue do — and why do we unlock before notify in the cv_.wait?",
      "Where does the pool's behavior break down under high job throughput?",
      "What does work stealing buy you, and how would you bolt it onto this design?",
    ],
  },
  {
    id: "cpp-adv-tasksystem-coro",
    title: "Wiring Coroutines to the Pool",
    difficulty: "Project",
    icon: "🪢",
    description:
      "Now the payoff: a coroutine that can \`co_await some_async_op()\` and \`co_await schedule_on(pool)\` to hop threads. We extend the Task<T> from the coroutines series with a continuation handshake and add a small \`schedule_on\` awaitable. Result: linear-looking async code on top of a thread pool — modern C++ for real.",
    concepts: [
      "Task<T> with continuation-aware final_suspend",
      "schedule_on(pool) awaitable",
      "Result delivery via promise + future bridge",
      "Cancellation propagation",
      "Where stdexec / libunifex go next",
    ],
    bridges: {
      Rust: "tokio::spawn + .await — same outcome, different naming.",
      Python: "asyncio.create_task + await — same model.",
      JavaScript: "Promise + async/await with a thread-pool worker pool.",
    },
    files: [
      {
        name: "task.h",
        code: \`#pragma once
#include <coroutine>
#include <exception>
#include <utility>
#include <optional>

template <typename T>
class Task {
public:
    struct promise_type {
        std::optional<T>       value;
        std::exception_ptr     ex;
        std::coroutine_handle<> continuation;

        using handle = std::coroutine_handle<promise_type>;

        Task               get_return_object()        { return Task{handle::from_promise(*this)}; }
        std::suspend_always initial_suspend() noexcept { return {}; }

        struct FinalAwaiter {
            bool await_ready() noexcept { return false; }
            std::coroutine_handle<> await_suspend(handle h) noexcept {
                auto c = h.promise().continuation;
                return c ? c : std::noop_coroutine();
            }
            void await_resume() noexcept {}
        };
        FinalAwaiter final_suspend() noexcept { return {}; }

        void return_value(T v)        { value = std::move(v); }
        void unhandled_exception()    { ex = std::current_exception(); }
    };

    using handle = std::coroutine_handle<promise_type>;

    Task(Task&& o) noexcept : h_(std::exchange(o.h_, {})) {}
    ~Task() { if (h_) h_.destroy(); }

    struct Awaiter {
        handle h;
        bool await_ready() noexcept { return h.done(); }
        std::coroutine_handle<> await_suspend(std::coroutine_handle<> caller) noexcept {
            h.promise().continuation = caller;
            return h;
        }
        T await_resume() {
            if (h.promise().ex) std::rethrow_exception(h.promise().ex);
            return std::move(*h.promise().value);
        }
    };
    Awaiter operator co_await() { return {h_}; }

    // Run this Task to completion synchronously on the current thread.
    T sync_wait() {
        h_.resume();
        // Caller-side: pump until done. For simplicity assume single-shot here.
        if (h_.promise().ex) std::rethrow_exception(h_.promise().ex);
        return std::move(*h_.promise().value);
    }

private:
    explicit Task(handle h) : h_(h) {}
    handle h_;
};`,
      },
      {
        name: "schedule_on.h",
        code: `#pragma once
#include <coroutine>
#include "thread_pool.h"

// AWAITABLE that resumes the awaiting coroutine on a thread pool.
// co_await schedule_on(pool); → next line runs on a pool worker.
struct schedule_on {
    ThreadPool& pool;
    bool await_ready() const noexcept { return false; }
    void await_suspend(std::coroutine_handle<> h) {
        pool.post([h] { h.resume(); });
    }
    void await_resume() const noexcept {}
};`,
      },
      {
        name: "demo.cpp",
        code: `#include "task.h"
#include "schedule_on.h"
#include "thread_pool.h"
#include <iostream>
#include <thread>

// A simulated I/O-bound operation that publishes its result via a Task.
Task<int> fetch(int id) {
    // Simulated work — in real life this would be an async file or socket op
    // that yields back to the executor.
    std::this_thread::sleep_for(std::chrono::milliseconds(50));
    co_return id * 100;
}

// Compose multiple awaits — looks synchronous, runs asynchronously.
Task<int> pipeline(ThreadPool& pool) {
    co_await schedule_on{pool};               // hop to a worker thread
    int a = co_await fetch(1);
    int b = co_await fetch(2);
    co_return a + b;
}

void demo() {
    ThreadPool pool;
    Task<int> t = pipeline(pool);
    std::cout << "result: " << t.sync_wait() << '\\n';   // 100 + 200 = 300
}

// WHAT'S HAPPENING:
//   1. pipeline() returns immediately — coroutine is at initial_suspend.
//   2. sync_wait() resumes it; pipeline hits \`co_await schedule_on(pool)\`.
//   3. schedule_on::await_suspend posts the continuation to the pool.
//   4. A worker thread resumes; continues to \`co_await fetch(1)\`.
//   5. fetch(1) returns Task<int>; its operator co_await suspends pipeline,
//      runs fetch to completion, then resumes pipeline via continuation.
//   6. Same for fetch(2). Final co_return delivers value via promise.
//   7. sync_wait sees value, returns.

// PRODUCTION-GRADE EXTENSIONS:
//   - Stop tokens propagated through Task<T> for cancellation.
//   - inline_scheduler vs static_thread_pool vs io_uring scheduler.
//   - when_all / when_any for fan-out.
//   - Symmetric transfer between Task<T> instances (we have it via FinalAwaiter).
//   - Custom allocator on the promise_type for coroutine frames.

// THIS PATTERN is the foundation of stdexec / libunifex / Asio's coroutine support.
// The lesson here: ~150 lines of carefully-arranged template metaprogramming
// give you Python-asyncio ergonomics with C++ performance.\`,
      },
    ],
    seedQuestions: [
      "Trace the execution of \`pipeline\` step-by-step — which thread runs each segment between awaits?",
      "How does \`final_suspend\`'s FinalAwaiter pass control back to the caller — what's the handoff?",
      "What would you change to support \`co_await when_all(t1, t2, t3)\` running in parallel?",
      "How would you propagate cancellation from the outer call into the awaiting fetch operations?",
    ],
  },
] };
