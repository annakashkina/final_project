export const cppCrtp = { name: "CRTP & Policy Design", lessons: [
  {
    id: "cpp-adv-crtp",
    title: "CRTP: Static Polymorphism",
    difficulty: "Advanced",
    icon: "🪞",
    description:
      "The Curiously Recurring Template Pattern: `class Derived : public Base<Derived>`. The base class knows the derived type at compile time, so it can call derived methods without virtual dispatch. Zero overhead, no vtable, but no runtime polymorphism either. Used for: mixins, static interfaces, expression templates.",
    concepts: [
      "Base<Derived> can call Derived methods statically",
      "No virtual cost, but compile-time only",
      "Common pitfall: forgetting to override (silent infinite recursion)",
      "CRTP for shared behavior across unrelated types",
      "When CRTP beats virtuals (perf, when derived is final)",
    ],
    bridges: {
      Rust: "Rust handles this via traits with default methods — `impl Trait for MyType` gives you the same shared behavior, no inheritance.",
      Haskell: "Type class default methods are the closest analog.",
      Java: "No equivalent. Generics + virtual dispatch is the closest.",
    },
    code: `#include <iostream>

// CRTP base — provides shared functionality by calling derived methods.
template <typename Derived>
class Comparable {
public:
    bool operator<=(const Derived& other) const {
        return self() < other || self() == other;
    }
    bool operator>(const Derived& other) const  { return !(self() <= other); }
    bool operator>=(const Derived& other) const { return !(self() < other); }
    bool operator!=(const Derived& other) const { return !(self() == other); }
private:
    const Derived& self() const { return static_cast<const Derived&>(*this); }
};

// Derived type only implements < and ==; gets the rest for free.
class Version : public Comparable<Version> {
    int major_, minor_;
public:
    Version(int M, int m) : major_(M), minor_(m) {}
    bool operator<(const Version& o)  const { return major_ < o.major_ || (major_ == o.major_ && minor_ < o.minor_); }
    bool operator==(const Version& o) const { return major_ == o.major_ && minor_ == o.minor_; }
};

// CRTP for static polymorphism.
template <typename Derived>
struct Shape {
    void render() const {
        // Compile-time call to derived's render_impl — no vtable.
        static_cast<const Derived&>(*this).render_impl();
    }
};

class Circle  : public Shape<Circle>  { friend Shape; void render_impl() const { std::cout << "circle\\n"; } };
class Square  : public Shape<Square>  { friend Shape; void render_impl() const { std::cout << "square\\n"; } };

// PITFALL: silent infinite recursion.
template <typename Derived>
struct Counter {
    void increment() {
        static_cast<Derived&>(*this).increment();  // BUG if Derived didn't override!
    }
};
// If derived class forgets to override increment, this calls itself forever.
// Fix: name the derived method differently (do_increment) so a missing override is a compile error.

// WHEN CRTP WINS:
//   - Hot path; virtuals are too slow.
//   - You want code reuse without runtime polymorphism.
//   - You need different return types per derived (impossible with virtuals + covariance limits).
//   - You want every operator (==, <, <=, etc.) defined in one place.

// WHEN VIRTUALS WIN:
//   - You need heterogeneous containers (vector<Shape*>).
//   - The set of types is open or runtime-determined.
//   - Polymorphic ownership through a base pointer.

// C++20 NOTE: std::three_way_comparison (\`<=>\`) plus the rewrite rules give you
// most of \`Comparable\` without CRTP. The pattern is still essential elsewhere.\`,
    seedQuestions: [
      "Why doesn't CRTP need virtual functions?",
      "What goes wrong if the derived class forgets to override the CRTP-expected method?",
      "Why can't you put CRTP types in a \`vector<Shape<???>*>\`?",
      "Given C++20's spaceship operator, when is \`Comparable\` CRTP still useful?",
    ],
  },
  {
    id: "cpp-adv-policy-design",
    title: "Policy-Based Design",
    difficulty: "Staff",
    icon: "🧱",
    description:
      "Policy-based design: parameterize a class by smaller types that decide individual behaviors — storage strategy, threading model, error handling. Composition over inheritance, at compile time. Used in \`std::shared_ptr\` (deleter, allocator), Boost.PolicyPtr, Loki, and any class that says 'pick a strategy'.",
    concepts: [
      "Policy = small type with a fixed interface",
      "Empty base optimization keeps stateless policies free",
      "Orthogonal policies compose",
      "Inversion: client picks behaviors, library combines them",
      "Where policy-based design beats virtual strategies",
    ],
    bridges: {
      Rust: "Rust generics with trait bounds + zero-cost abstractions express the same idea.",
      Java: "Strategy pattern at runtime is the closest cousin — but pays virtual call cost.",
      Haskell: "Type classes + newtypes for choosing behavior.",
    },
    code: \`#include <iostream>
#include <mutex>
#include <stdexcept>

// POLICIES — each defines a small interface.

// 1. Threading policy.
struct SingleThreaded {
    struct Lock { Lock(SingleThreaded&) {} };
};
struct MultiThreaded {
    std::mutex m;
    struct Lock { std::lock_guard<std::mutex> g; Lock(MultiThreaded& s) : g(s.m) {} };
};

// 2. Error policy.
struct ThrowOnError      { static void fail(const char* msg) { throw std::runtime_error(msg); } };
struct AbortOnError      { static void fail(const char* msg) { std::cerr << msg; std::abort(); } };
struct StatusCodeOnError { static int  fail(const char* /*msg*/) { return -1; } };

// 3. Logging policy.
struct NoLog        { static void log(const char*) {} };
struct StderrLog    { static void log(const char* m) { std::cerr << m << '\\n'; } };

// HOST CLASS — composes the policies.
template <typename Threading = SingleThreaded,
          typename ErrorPol  = ThrowOnError,
          typename LogPol    = NoLog>
class Cache : Threading, LogPol {     // EBO: stateless policies cost nothing
    int storage_[64]{};
public:
    int get(int key) {
        typename Threading::Lock lk(*this);
        LogPol::log("get called");
        if (key < 0 || key >= 64) ErrorPol::fail("out of range");
        return storage_[key];
    }
};

// USE — caller picks behaviors.
void demo() {
    Cache<SingleThreaded, ThrowOnError, NoLog>     c1;   // fast, throws
    Cache<MultiThreaded, AbortOnError, StderrLog>  c2;   // thread-safe, aborts, logs

    // Each instantiation is a separate compile-time type with optimized code paths.
    // No virtual calls. Stateless policies vanish via EBO — sizeof(c1) is just storage_.
}

// PRINCIPLE: each policy is orthogonal — choices don't entangle.
//   Threading × Error × Logging = 2 × 3 × 2 = 12 possible combinations.
//   Without policies you'd write 12 classes or 12 virtual dispatches.

// COMPARE with strategy pattern (runtime polymorphism):
//   Policies decided at compile time → zero overhead.
//   Strategy decided at runtime     → can change per object, but virtual call cost.

// SHIPPED IN STD: std::shared_ptr's deleter + allocator are policies.
//                 std::unique_ptr's deleter is a policy.
//                 std::basic_string's traits + allocator are policies.\`,
    seedQuestions: [
      "Why does inheriting from a stateless policy add zero bytes to the host class?",
      "What's the practical limit on the number of policies before client code becomes unwieldy?",
      "Compare policy-based design vs strategy pattern: when does each win?",
      "How does std::shared_ptr's deleter+allocator fit this pattern?",
    ],
  },
  {
    id: "cpp-adv-expr-templates",
    title: "Expression Templates",
    difficulty: "Staff",
    icon: "🧮",
    description:
      "Expression templates capture a numeric expression's STRUCTURE in the type system, deferring evaluation until needed. Used in Eigen, Blaze, xtensor: \`auto z = a + b * c;\` builds a type representing \`(a + (b*c))\` and evaluates with one pass — no temporaries. The technique that makes 'numpy-but-faster' possible in C++.",
    concepts: [
      "Lazy evaluation via types",
      "Avoiding temporary vectors/matrices",
      "Operator overloading returning expression nodes",
      "When SIMD and loop fusion kick in",
      "Caveats: auto pitfall, expression lifetime",
    ],
    bridges: {
      Rust: "ndarray + similar crates implement related ideas; less ergonomic without operator overloading.",
      Julia: "Lazy broadcasting (\`@.\`) does this dynamically.",
      Haskell: "Lazy evaluation native; expression templates are how you achieve laziness in eager languages.",
    },
    code: \`#include <cstddef>
#include <vector>
#include <iostream>

// Minimal expression-template vector add/scale.
template <typename L, typename R>
struct VecAdd {
    const L& l; const R& r;
    auto operator[](std::size_t i) const { return l[i] + r[i]; }
    std::size_t size() const             { return l.size(); }
};

template <typename L>
struct VecScale {
    const L& l; double s;
    auto operator[](std::size_t i) const { return l[i] * s; }
    std::size_t size() const             { return l.size(); }
};

struct Vec {
    std::vector<double> data;
    double  operator[](std::size_t i) const { return data[i]; }
    double& operator[](std::size_t i)       { return data[i]; }
    std::size_t size() const                { return data.size(); }

    // Evaluation point: assignment from ANY expression.
    template <typename Expr>
    Vec& operator=(const Expr& e) {
        data.resize(e.size());
        for (std::size_t i = 0; i < e.size(); ++i) data[i] = e[i];  // one fused loop!
        return *this;
    }
};

// Operators build expression-tree NODES (no evaluation).
template <typename L, typename R>
auto operator+(const L& l, const R& r) { return VecAdd<L, R>{l, r}; }
template <typename L>
auto operator*(const L& l, double s)   { return VecScale<L>{l, s}; }

// USAGE.
void demo() {
    Vec a{{1, 2, 3}}, b{{4, 5, 6}}, c{{7, 8, 9}};
    Vec z;
    z = a + b * 2.0 + c;
    //  ^^^^^^^^^^^^^^^^^^^^
    // Type of RHS: VecAdd< VecAdd<Vec, VecScale<Vec>>, Vec >
    // Assignment runs ONE loop, accessing l[i]+r[i] etc.
    // No temporary vectors. No intermediate allocations.
}

// PITFALL #1: AUTO + expression templates.
// auto e = a + b * 2.0 + c;
// e holds references to a, b, c. If any of them dies before e is evaluated → UB.
// Eigen has this exact footgun documented.

// PITFALL #2: re-evaluation cost.
// std::cout << e[0] << e[1];     // recomputes (a+b*2+c) at each index.
// Materialize first if you'll read repeatedly:
//   Vec materialized = e;

// REAL libraries add:
//   - SIMD evaluation per chunk
//   - Aliasing detection (a = a + a*0.5 needs care)
//   - Lazy broadcasting (different sizes)
//   - Heterogeneous element types via CommonType\`,
    seedQuestions: [
      "Why does \`z = a + b * 2.0 + c\` end up as a single loop?",
      "What's the danger of capturing an expression template in \`auto\`?",
      "Where would SIMD vectorization plug into the evaluation loop?",
      "Why does evaluating the same expression multiple times re-traverse it — and what fixes that?",
    ],
  },
] };
