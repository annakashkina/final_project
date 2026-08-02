export const cppCoroutines = { name: "Coroutines", lessons: [
  {
    id: "cpp-adv-coro-mechanics",
    title: "Coroutine Mechanics: co_await, co_yield, co_return",
    difficulty: "Staff",
    icon: "🌀",
    description:
      "A C++ coroutine is a function that can SUSPEND and RESUME. Any function containing `co_await`, `co_yield`, or `co_return` is a coroutine — and the compiler rewrites it into a state machine. Unlike Python or Rust async, C++ gives you the raw primitives and asks you to assemble your own task type. Powerful, fast, and unforgiving.",
    concepts: [
      "What makes a function a coroutine",
      "The compiler-generated state machine",
      "Heap allocation of coroutine state (HALO)",
      "co_await, co_yield, co_return semantics",
      "Promise type + handle architecture",
    ],
    bridges: {
      Python: "Python's async/await is similar at the syntax level. C++ coroutines are far lower-level: you build the equivalent of asyncio yourself.",
      Rust: "Rust async functions return Future. C++ coroutine return types are arbitrary — you write the Task/Generator type.",
      JavaScript: "Generators (function*) and async functions are the precedents; conceptually identical.",
    },
    code: `#include <coroutine>
#include <utility>
#include <iostream>

// MINIMAL "Task" — a coroutine return type.
// To be a coroutine return type, a class must have a nested promise_type.

struct Task {
    struct promise_type {
        Task get_return_object()        { return {}; }
        std::suspend_never initial_suspend() noexcept { return {}; } // start eagerly
        std::suspend_never final_suspend()   noexcept { return {}; } // self-destruct
        void return_void() {}
        void unhandled_exception() { std::terminate(); }
    };
};

// A coroutine: contains co_return (or co_await/co_yield).
Task hello() {
    std::cout << "before\\n";
    co_return;                          // marks this as a coroutine
    // std::cout << "after\\n";          // unreachable
}

// THE COMPILER-GENERATED STATE MACHINE (conceptually).
// The body of \`hello\` is rewritten into:
//   - allocate a coroutine frame (usually heap; HALO may elide)
//   - construct the promise_type inside the frame
//   - call promise.get_return_object() → that's what the caller gets
//   - co_await promise.initial_suspend() — possibly suspend before body
//   - run the body up to each suspension point
//   - co_await promise.final_suspend() — give a chance to publish results
//   - destroy the frame

// CO_AWAIT desugars to:
//   auto&& awaiter = operator co_await(expr);   // or expr if no operator
//   if (!awaiter.await_ready()) {
//       awaiter.await_suspend(coro_handle);     // may return: void, bool, or coro_handle
//       // ... actually suspend ...
//   }
//   awaiter.await_resume();

// SIMPLE awaiters — std::suspend_always and std::suspend_never.

// THE COROUTINE FRAME is HEAP-ALLOCATED (in general).
// The compiler can elide this allocation via HALO when:
//   - the lifetime is fully nested in the caller, AND
//   - all transformations are visible to the optimizer.
// Practical advice: don't rely on HALO; design for the allocation.

// THE ALLOCATION POINT is \`operator new\` on the promise_type if defined,
// else ::operator new. You can supply a custom allocator by overriding it.

// CO_YIELD desugars to:
//   co_await promise.yield_value(expr);
// → makes generator-style suspend-and-deliver-a-value natural.

// CO_RETURN desugars to:
//   promise.return_value(expr);          // or return_void() with no expr
// → final_suspend then runs.

// WHO RESUMES? Whoever holds the coroutine_handle calls .resume().
// In real code, an event loop, an awaiter's await_suspend, or another coroutine resumes.\`,
    seedQuestions: [
      "What single ingredient turns an ordinary function into a coroutine?",
      "What does the compiler do with the body of a coroutine — what's the rewrite called?",
      "Why is the coroutine frame typically heap-allocated, and what does HALO do about it?",
      "Walk through what happens at a \`co_await expr\` — what three awaiter methods get called?",
    ],
  },
  {
    id: "cpp-adv-coro-promise",
    title: "Promise Types in Detail",
    difficulty: "Staff",
    icon: "🤝",
    description:
      "The \`promise_type\` is the customization point for everything a coroutine does. It controls allocation, initial/final suspension, exception handling, and return-value delivery. Designing one is how you turn a generic 'coroutine' into a 'task', 'generator', 'lazy', or whatever your library models.",
    concepts: [
      "Required promise members",
      "initial_suspend / final_suspend choices",
      "return_value vs return_void",
      "yield_value for generators",
      "Custom operator new for arenas",
    ],
    bridges: {
      Python: "Equivalent of asyncio's Task/Future plumbing.",
      Rust: "Equivalent of the executor + Future + Waker contract.",
      JavaScript: "Roughly the Promise machinery + the host runtime.",
    },
    code: \`#include <coroutine>
#include <optional>
#include <utility>
#include <stdexcept>

// EAGER vs LAZY task — depends on initial_suspend.
//   suspend_never  → coroutine runs to first await on construction
//   suspend_always → caller must explicitly resume

// EAGER Task<T> with value return.
template <typename T>
struct Task {
    struct promise_type {
        std::optional<T> value;
        std::exception_ptr ex;

        Task                  get_return_object()  { return Task{handle::from_promise(*this)}; }
        std::suspend_never    initial_suspend() noexcept { return {}; }
        std::suspend_always   final_suspend()   noexcept { return {}; } // keep frame alive for value retrieval
        void                  return_value(T v)       { value = std::move(v); }
        void                  unhandled_exception()   { ex = std::current_exception(); }
    };
    using handle = std::coroutine_handle<promise_type>;
    handle h_;

    explicit Task(handle h) : h_(h) {}
    ~Task() { if (h_) h_.destroy(); }
    Task(Task&& o) noexcept : h_(std::exchange(o.h_, {})) {}

    T get() {
        if (h_.promise().ex) std::rethrow_exception(h_.promise().ex);
        return std::move(*h_.promise().value);
    }
};

// GENERATOR — uses yield_value.
template <typename T>
struct Generator {
    struct promise_type {
        std::optional<T> current;
        Generator                 get_return_object()  { return Generator{handle::from_promise(*this)}; }
        std::suspend_always       initial_suspend() noexcept { return {}; } // lazy
        std::suspend_always       final_suspend()   noexcept { return {}; }
        std::suspend_always       yield_value(T v)         { current = std::move(v); return {}; }
        void                      return_void() {}
        void                      unhandled_exception() { std::terminate(); }
    };
    using handle = std::coroutine_handle<promise_type>;
    handle h_;

    explicit Generator(handle h) : h_(h) {}
    ~Generator() { if (h_) h_.destroy(); }

    bool next() {
        if (h_.done()) return false;
        h_.resume();
        return !h_.done();
    }
    T value() { return std::move(*h_.promise().current); }
};

Generator<int> count_to(int n) {
    for (int i = 0; i < n; ++i) co_yield i;
}

// USE:
//   auto g = count_to(5);
//   while (g.next()) std::cout << g.value() << ' ';

// CUSTOM ALLOCATOR — override operator new on the promise_type.
struct ArenaTask {
    struct promise_type {
        static void* operator new(std::size_t sz) {
            // allocate from a thread-local arena, etc.
            return ::operator new(sz);
        }
        static void operator delete(void* p, std::size_t /*sz*/) {
            ::operator delete(p);
        }
        // ... rest of promise members ...
    };
};

// EXCEPTION DELIVERY: unhandled_exception captures via std::current_exception().
// You then rethrow at .get() or wherever you surface the result.\`,
    seedQuestions: [
      "Why does Task<T> use suspend_always in final_suspend but suspend_never in initial_suspend?",
      "What does yield_value need to do to deliver a value AND allow the caller to consume it?",
      "When would you provide a custom operator new on a promise_type?",
      "How does unhandled_exception interact with the .get() / .next() that consumes the coroutine?",
    ],
  },
  {
    id: "cpp-adv-coro-awaitable",
    title: "Awaiters & Awaitables",
    difficulty: "Staff",
    icon: "⏸️",
    description:
      "An *awaiter* is the object that decides what \`co_await expr\` actually does. Three methods: \`await_ready\` (am I done already?), \`await_suspend\` (here's a handle; do whatever with it), \`await_resume\` (return value to the coroutine). With these three knobs you can wire coroutines to I/O completion ports, timers, channels, or other coroutines.",
    concepts: [
      "await_ready / await_suspend / await_resume",
      "Return types of await_suspend (void, bool, handle)",
      "Symmetric transfer with coroutine_handle return",
      "Awaiters that schedule on an executor",
      "Composing awaitables",
    ],
    bridges: {
      Python: "Awaitable protocol via __await__; awaiters analogous to yielding tuples to the event loop.",
      Rust: "Future::poll plays the role of await_ready+await_resume; the Waker is the resume handle.",
      JavaScript: "Then-able objects: any obj with .then(resolve, reject) is awaitable.",
    },
    code: \`#include <coroutine>
#include <chrono>
#include <thread>
#include <iostream>

// SIMPLE AWAITER — suspends until a value is "delivered" by another thread.
struct Signal {
    std::atomic<bool>         ready{false};
    std::coroutine_handle<>   suspended;

    bool await_ready() const noexcept { return ready.load(std::memory_order_acquire); }
    void await_suspend(std::coroutine_handle<> h) noexcept {
        suspended = h;
        // In production: register with an executor or condition.
    }
    void await_resume() const noexcept {}

    void notify() {
        ready.store(true, std::memory_order_release);
        if (suspended) suspended.resume();   // beware: resumes on caller's thread
    }
};

// AWAITER that yields to another coroutine (SYMMETRIC TRANSFER).
struct TransferTo {
    std::coroutine_handle<> target;
    bool await_ready() const noexcept { return false; }
    std::coroutine_handle<> await_suspend(std::coroutine_handle<>) noexcept {
        return target;                         // hand control to target — NO recursion in stack
    }
    void await_resume() const noexcept {}
};
// Symmetric transfer is critical for deep call chains:
// each "tail-call" handoff doesn't grow the C++ stack.

// AWAITER for an EXECUTOR — schedule resume on a thread pool.
class ThreadPool;                              // imagined
struct ResumeOn {
    ThreadPool* pool;
    bool await_ready() const noexcept { return false; }
    void await_suspend(std::coroutine_handle<> h) {
        // pool->post([h] { h.resume(); });
    }
    void await_resume() const noexcept {}
};

// USE within a coroutine:
//   co_await ResumeOn{&thread_pool};         // hop to pool thread
//   // ... work happens on a pool worker ...

// AWAITER RETURN TYPES from await_suspend:
//   void                       — suspended, control returns to who resumed/called.
//   bool                       — true: suspend; false: continue immediately.
//   std::coroutine_handle<>    — symmetric transfer: jump to that handle's resume.

// COMPOSING — operator co_await can return a different awaiter:
struct Sleeper {
    std::chrono::milliseconds dur;
};
auto operator co_await(Sleeper s) {
    struct awaiter {
        std::chrono::milliseconds dur;
        bool await_ready() const noexcept { return false; }
        void await_suspend(std::coroutine_handle<> h) {
            std::thread([h, d = dur] {
                std::this_thread::sleep_for(d);
                h.resume();
            }).detach();
        }
        void await_resume() const noexcept {}
    };
    return awaiter{s.dur};
}

// In a coroutine:
//   co_await Sleeper{std::chrono::milliseconds(100)};\`,
    seedQuestions: [
      "What's the difference between await_ready returning true vs await_suspend never suspending?",
      "How does symmetric transfer prevent stack overflow in long awaiter chains?",
      "Why might \`await_suspend\` need to return a \`bool\` vs a \`coroutine_handle\` vs \`void\`?",
      "How does \`operator co_await\` let you adapt arbitrary types into awaitables?",
    ],
  },
  {
    id: "cpp-adv-coro-generator",
    title: "Practical Generators",
    difficulty: "Staff",
    icon: "🎰",
    description:
      "Generators are the most approachable use of coroutines: a lazy iterable producing values on demand. With C++23's \`std::generator\`, this is now in the standard. Before that, every coroutine library had its own. Building one yourself shows the integration with ranges, exception handling, and iterator-style consumption.",
    concepts: [
      "Lazy iterator semantics",
      "std::generator (C++23)",
      "Iterator + sentinel for range-based for",
      "Exception delivery from inside the generator",
      "When generators beat manual iterators",
    ],
    bridges: {
      Python: "Same model as Python generators — yield delivers, next() drives.",
      Rust: "Rust's Iterator + impl with a state machine is the manual analog. Async iterators (Stream) closer to coroutine generators.",
      JavaScript: "function* + yield — direct correspondence.",
    },
    code: \`#include <coroutine>
#include <optional>
#include <ranges>
#include <iostream>

// Our Generator from earlier, extended with iterator interface.
template <typename T>
class Generator {
    struct promise_type;
public:
    using handle = std::coroutine_handle<promise_type>;

    struct promise_type {
        T current;
        Generator             get_return_object()  { return Generator{handle::from_promise(*this)}; }
        std::suspend_always   initial_suspend() noexcept { return {}; }
        std::suspend_always   final_suspend()   noexcept { return {}; }
        std::suspend_always   yield_value(T v)       { current = std::move(v); return {}; }
        void                  return_void() {}
        void                  unhandled_exception() { throw; }
    };

    explicit Generator(handle h) : h_(h) {}
    Generator(Generator&& o) noexcept : h_(std::exchange(o.h_, {})) {}
    ~Generator() { if (h_) h_.destroy(); }

    // ITERATOR support for range-based for.
    struct iterator {
        handle h;
        iterator& operator++() { h.resume(); return *this; }
        T const& operator*() const { return h.promise().current; }
        bool operator==(std::default_sentinel_t) const { return !h || h.done(); }
    };
    iterator begin() {
        if (h_) h_.resume();
        return {h_};
    }
    std::default_sentinel_t end() { return {}; }

private:
    handle h_;
};

// USAGE — feels like Python.
Generator<int> fibonacci(int n) {
    int a = 0, b = 1;
    for (int i = 0; i < n; ++i) {
        co_yield a;
        std::tie(a, b) = std::pair{b, a + b};
    }
}

void demo() {
    for (int x : fibonacci(10)) std::cout << x << ' ';
    // 0 1 1 2 3 5 8 13 21 34
}

// COMPOSE with ranges (C++20):
//   for (int x : fibonacci(20) | std::views::take(5)) ...
// (Requires a generator with appropriate range concept conformance; std::generator in C++23 does this.)

// C++23 std::generator<T>:
//   #include <generator>
//   std::generator<int> count(int n) {
//       for (int i = 0; i < n; ++i) co_yield i;
//   }
//   Built-in, fully ranges-compatible, allocator-aware.

// EXCEPTION DELIVERY:
//   If the body throws, unhandled_exception captures (we re-throw to caller of resume).
//   Iterator's ++ then propagates to the user.

// WHEN GENERATORS BEAT MANUAL ITERATORS:
//   - Stateful traversal (tree walking, parsing, search).
//   - Pull-based pipelines.
//   - Avoid materializing the whole sequence.
//   COST: heap allocation for the frame, suspension overhead.
//   Not a fit for hot inner loops that process millions of items per second.\`,
    seedQuestions: [
      "How does \`begin()\` work on this generator — what does it do with the handle?",
      "Why must the iterator's \`==\` compare against \`default_sentinel_t\` instead of another iterator?",
      "What's the cost of a coroutine generator vs hand-written iterator over a simple sequence?",
      "How does std::generator in C++23 simplify this design?",
    ],
  },
  {
    id: "cpp-adv-coro-async",
    title: "Async I/O with Coroutines",
    difficulty: "Staff",
    icon: "⚡",
    description:
      "The 'killer app' for coroutines: write linear-looking async I/O code with no callback hell, no continuations. The piece you need is a Task type that composes (one task can co_await another) and an executor that drives ready coroutines. Boost.Asio, libunifex, and stdexec all wire this up — but the underlying ideas are simple.",
    concepts: [
      "Task<T> that supports co_await",
      "Continuation passing via promise_type::final_suspend",
      "Executor: who calls .resume()",
      "Coroutine composition rules",
      "Cancellation propagation through tasks",
    ],
    bridges: {
      Python: "asyncio.gather, await pattern. C++ stdexec is heading this direction in std.",
      Rust: "tokio::spawn + .await — model is nearly identical.",
      Go: "Goroutines are simpler (stackful) but the linear-looking I/O outcome is the same.",
    },
    code: \`#include <coroutine>
#include <utility>
#include <atomic>
#include <iostream>

// AWAITABLE Task<T> — a coroutine return type that itself is awaitable.
template <typename T>
class Task {
    struct promise_type;
public:
    using handle = std::coroutine_handle<promise_type>;
    struct promise_type {
        T                            value;
        std::coroutine_handle<>      continuation;          // who resumes us

        Task                  get_return_object() { return Task{handle::from_promise(*this)}; }
        std::suspend_always   initial_suspend() noexcept { return {}; }  // LAZY

        // FINAL SUSPEND with continuation handoff (symmetric transfer).
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
        void unhandled_exception()    { std::terminate(); }
    };

    Task(Task&& o) noexcept : h_(std::exchange(o.h_, {})) {}
    ~Task() { if (h_) h_.destroy(); }

    // MAKE Task<T> AWAITABLE.
    struct Awaiter {
        handle h;
        bool await_ready() noexcept { return h.done(); }
        std::coroutine_handle<> await_suspend(std::coroutine_handle<> caller) noexcept {
            h.promise().continuation = caller;
            return h;                                       // start/continue this task
        }
        T await_resume() { return std::move(h.promise().value); }
    };
    Awaiter operator co_await() { return {h_}; }

    T sync_wait() {
        h_.resume();
        return std::move(h_.promise().value);
    }

private:
    explicit Task(handle h) : h_(h) {}
    handle h_;
};

// USAGE — composable tasks.
Task<int> leaf()         { co_return 7; }
Task<int> middle()       { int x = co_await leaf(); co_return x * 2; }
Task<int> top()          { int y = co_await middle(); co_return y + 1; }

void run() {
    Task<int> t = top();
    int result = t.sync_wait();                            // 15
    std::cout << result << '\\n';
}

// EXECUTOR (sketch). Real ones implement scheduling, IO completion, work-stealing.
// The pattern: when you'd block, you schedule .resume() on the executor instead.

// CANCELLATION: pass a stop_token through tasks. Awaiters check the token before suspending.
// Modern frameworks (libunifex, stdexec) build this into the sender/receiver model.

// MENTAL MODEL: a Task is a lazy computation; co_await drives one Task from another;
// the executor drives the root Task; symmetric transfer keeps the stack flat.\`,
    seedQuestions: [
      "How does symmetric transfer through \`final_suspend\` chain continuations without growing the C++ stack?",
      "Why does Task start in suspend_always (lazy) but resume immediately when awaited?",
      "What role does the executor play, and what minimum interface does it need?",
      "How would you propagate cancellation through a chain of Task<T> awaits?",
    ],
  },
] };
