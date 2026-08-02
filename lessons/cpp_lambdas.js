export const cppLambdas = { name: "Lambdas Deep", lessons: [
  {
    id: "cpp-adv-captures",
    title: "Captures, Init-Captures, Move-Captures",
    difficulty: "Advanced",
    icon: "🪤",
    description:
      "Captures decide what data a lambda owns. `[=]` copies, `[&]` references, `[this]` captures pointer-to-this (footgun in async code), `[*this]` (C++17) copies the object. Init-captures `[x = expr]` let you compute or move captures — including the only way to capture a unique_ptr.",
    concepts: [
      "Default captures = and & — pros, cons, traps",
      "Capturing `this` vs `*this`",
      "Init-captures and move-capture idiom",
      "Lifetime traps with async callbacks",
      "constexpr & mutable lambdas",
    ],
    bridges: {
      Rust: "Rust closures auto-capture; `move` keyword forces ownership transfer. C++ requires explicit capture lists.",
      JavaScript: "JS closures always capture by reference. C++ forces choice — and exposes the bugs.",
      Python: "Python's late-binding closure is a category of bug C++ avoids by making capture explicit.",
    },
    code: `#include <memory>
#include <thread>
#include <functional>
#include <iostream>

void capture_basics() {
    int x = 1;
    int y = 2;

    auto by_value = [x, y]()    { return x + y; };
    auto by_ref   = [&x, &y]()  { return x + y; };
    auto def_val  = [=]()       { return x + y; };
    auto def_ref  = [&]()       { return x + y; };
    auto mixed    = [=, &y]()   { return x + y; };       // copy x, ref y

    // MUTABLE: the captured copies are normally const inside.
    auto counter = [n = 0]() mutable { return ++n; };    // 1, 2, 3, ...
}

// INIT-CAPTURES (C++14).
void init_captures() {
    auto p = std::make_unique<int>(42);
    // auto f = [p](){};                 // ERROR: unique_ptr not copyable
    auto f = [p = std::move(p)]() {       // OK: move-capture via init-capture
        std::cout << *p;
    };
    // p here is moved-from; do not use.
}

// LIFETIME TRAP with default ref capture.
std::function<int()> make_counter_BAD() {
    int n = 0;
    return [&n]() { return ++n; };       // BUG: returned lambda references dead n
}
std::function<int()> make_counter_OK() {
    int n = 0;
    return [n]() mutable { return ++n; }; // OK: copy
}

// THIS vs *THIS — async footgun.
class Service {
    int counter_ = 0;
public:
    void start_BAD() {
        std::thread t([this] {
            for (int i = 0; i < 100; ++i) counter_++;     // dangling if *this dies
        });
        t.detach();
    }
    void start_OK_cpp17() {
        std::thread t([*this]() mutable {                 // copy the WHOLE object
            for (int i = 0; i < 100; ++i) counter_++;     // updates the COPY
        });
        t.detach();
    }
};
// For shared lifetime: use shared_from_this() (see enable_shared_from_this).

// CAPTURING a pack — variadic init-capture.
template <typename... Args>
auto bind_all(Args&&... args) {
    return [...captures = std::forward<Args>(args)]() {  // C++20 pack capture
        // ...
    };
}

// CONSTEXPR LAMBDAS (C++17): all captures and body constexpr-evaluable.
constexpr auto square = [](int x) { return x * x; };
static_assert(square(5) == 25);`,
    seedQuestions: [
      "Why does `[=]` copy mean the lambda's stored copies are const, requiring `mutable` to write to them?",
      "What's the practical difference between `[this]` and `[*this]` in an async callback?",
      "Why is `make_counter_BAD()` a use-after-free, and how does the `mutable` version fix it?",
      "How does init-capture let you move a unique_ptr into a lambda?",
    ],
  },
  {
    id: "cpp-adv-generic-lambdas",
    title: "Generic & Template Lambdas",
    difficulty: "Advanced",
    icon: "λ",
    description:
      "Generic lambdas (`auto` parameters, C++14) turn lambdas into local function templates. Template lambdas (C++20, `[]<typename T>(T)`) let you name the type parameter, useful when you need to refer to it. Together with `if constexpr`, you write polymorphic local code without any class boilerplate.",
    concepts: [
      "auto parameters = implicit template",
      "Template lambda syntax for explicit T",
      "decltype and forwarding inside generic lambdas",
      "Recursion: explicit self-reference",
      "Overload-set capture trick",
    ],
    bridges: {
      Rust: "Rust closures aren't generic over types. `impl Fn` lets you pass them but each closure is monomorphic.",
      Python: "Python's dynamic typing makes every lambda implicitly polymorphic.",
      JavaScript: "Same as Python — JS has no static typing on lambda params.",
    },
    code: `#include <iostream>
#include <vector>
#include <string>
#include <type_traits>

// GENERIC LAMBDA (C++14).
auto print = [](const auto& x) { std::cout << x << '\\n'; };

void demo() {
    print(1);              // int
    print(3.14);           // double
    print("hello");        // const char*
    print(std::string{});  // std::string
}

// EQUIVALENT class with templated operator():
struct PrintT {
    template <typename T>
    void operator()(const T& x) const { std::cout << x << '\\n'; }
};

// TEMPLATE LAMBDA (C++20) — name the type parameter.
auto add = []<typename T>(T a, T b) { return a + b; };
//          ^^^^^^^^^^^^^
// Forces both arguments to be the same type — generic lambda can't easily express this.

// USE: forwarding inside a generic lambda needs decltype.
auto wrap = [](auto&&... args) {
    return some_fn(std::forward<decltype(args)>(args)...);
};

// RECURSION — lambdas can't see themselves by name.
// Trick #1: std::function (heap, virtual).
std::function<int(int)> fact1 = [&](int n) { return n <= 1 ? 1 : n * fact1(n - 1); };

// Trick #2: pass self as first parameter (Y combinator-ish).
auto fact2 = [](auto self, int n) -> int { return n <= 1 ? 1 : n * self(self, n - 1); };
int f5 = fact2(fact2, 5);   // 120

// Trick #3 (C++23): "deducing this".
//   struct Fact { int operator()(this auto&& self, int n) { ... self(n-1) ... } };

// CAPTURING AN OVERLOAD SET — store + dispatch.
auto greet = [](auto&&... args) { /* dispatch by type via if constexpr */ };

// PRACTICAL: STL with generic lambdas.
std::vector v{1, 2, 3, 4, 5};
auto count = std::count_if(v.begin(), v.end(), [](auto x){ return x > 2; });

// PASSING a generic lambda as a template arg — each closure type is unique.
template <typename F> void run(F f) { f(1); f("hi"); }
void usage() {
    run([](const auto& x) { std::cout << x; });
    // Note: F is the unnamed type of the lambda; the template instantiates twice (for x=int, x=const char*).
}`,
    seedQuestions: [
      "Why does a generic lambda effectively contain a function template?",
      "When does the C++20 `[]<typename T>` syntax give you something the auto-parameter form can't?",
      "Why can't a lambda call itself by name — what tricks recover recursion?",
      "If you instantiate the same generic lambda with two different argument types, are they the same function?",
    ],
  },
  {
    id: "cpp-adv-lambda-as-fn-obj",
    title: "Lambdas as Function Objects",
    difficulty: "Staff",
    icon: "🎒",
    description:
      "Every lambda is a unique unnamed class with `operator()`. This makes it composable with the rest of the type system: deduced as a template parameter, stored as a member, default-constructed (C++20 if captureless), used as a custom deleter, used as a comparator that costs zero bytes. Knowing this opens performance and design space.",
    concepts: [
      "Each lambda has a unique closure type",
      "Captureless lambdas convert to function pointers",
      "C++20: captureless lambdas are default-constructible",
      "Use as map/set comparator (no allocation)",
      "Stateless lambda as customization point",
    ],
    bridges: {
      Rust: "Each closure has a unique anonymous type, same as C++. `Fn`/`FnMut`/`FnOnce` traits play the role of operator().",
      Java: "Lambdas become anonymous-class instances with shared method dispatch.",
      Python: "Lambdas are first-class functions; no unique type per lambda.",
    },
    code: `#include <map>
#include <set>
#include <memory>
#include <type_traits>
#include <utility>

// CAPTURELESS lambda → function pointer conversion.
auto f = [](int x) { return x * 2; };
int (*fp)(int) = f;                          // OK: captureless lambdas convert to fn ptrs
// auto g = [n = 0](int x){ return x + n; };
// int (*gp)(int) = g;                       // ERROR: capturing lambda doesn't convert

// LAMBDA AS DELETER — zero-byte custom deleter via EBO.
auto fd_close = [](int* fd) { ::close(*fd); delete fd; };
std::unique_ptr<int, decltype(fd_close)> wrap(new int(7), fd_close);

// LAMBDA AS COMPARATOR — zero allocation.
auto cmp = [](const std::string& a, const std::string& b) { return a.size() < b.size(); };
std::set<std::string, decltype(cmp)> by_length{cmp};

// C++20: STATELESS lambdas are DEFAULT CONSTRUCTIBLE and ASSIGNABLE.
//   This means you can write decltype(cmp) directly without passing cmp at construction.
std::set<std::string, decltype([](auto& a, auto& b) { return a.size() < b.size(); })> bl2;

// IIFE — immediately invoked lambda. Initialize complex const variables cleanly.
const std::vector<int> precomputed = []() {
    std::vector<int> v;
    for (int i = 0; i < 100; ++i) v.push_back(i * i);
    return v;
}();

// LAMBDA TYPES propagate through templates.
template <typename F>
class JobQueue {
    std::vector<F> jobs_;       // each F is a distinct closure type
public:
    void add(F f) { jobs_.push_back(std::move(f)); }
};
// Each call site instantiates JobQueue<unique-closure-type>.
// For a HOMOGENEOUS queue, use std::function or std::move_only_function.

// SIZEOF lambda = sizeof of its captures, padded for alignment.
auto small = []{};                          // sizeof == 1 (empty class)
int x = 0;
auto with_int = [x]{};                      // sizeof >= sizeof(int)

// AVOID storing capturing lambdas via std::function in hot paths — virtual call cost.
// Prefer template parameter (static dispatch) when the call site is monomorphic.\`,
    seedQuestions: [
      "Why do captureless lambdas convert to function pointers but capturing ones don't?",
      "What's the C++20 change that lets you use \`decltype(lambda)\` as a default-constructible comparator?",
      "Why is \`sizeof([]{})\` typically 1 instead of 0?",
      "When would you reach for IIFE (immediately invoked lambda) instead of a helper function?",
    ],
  },
] };
