export const cppErasure = { name: "Type Erasure", lessons: [
  {
    id: "cpp-adv-any-variant",
    title: "std::any, std::variant, std::optional",
    difficulty: "Advanced",
    icon: "🎭",
    description:
      "The standard library ships three vocabulary types for 'one of these things': `optional<T>` (T or nothing), `variant<Ts...>` (one of a closed set), `any` (one of anything). Each picks a different point on the type-safety/flexibility trade. They share a deep internal trick: tagged union with proper lifetime management.",
    concepts: [
      "optional: empty state + T, no allocation",
      "variant: tagged union with type-safe access",
      "any: type-erased holder with RTTI",
      "std::visit and the visitor pattern",
      "Performance: variant ≪ any (no allocation, no RTTI)",
    ],
    bridges: {
      Rust: "Rust's `Option<T>` = optional, `enum` with variants ≈ variant. Rust has no `Any` in std but `Box<dyn Any>` is close.",
      Haskell: "Maybe = optional, Either/sum types = variant.",
      Java: "Optional<T> exists. variant has no analog (sealed classes are similar). Object reference is like any but boxed.",
    },
    code: `#include <optional>
#include <variant>
#include <any>
#include <string>
#include <iostream>

// OPTIONAL — present or absent. No heap. Stack-allocated alongside T.
std::optional<int> parse(const std::string& s) {
    try { return std::stoi(s); } catch (...) { return std::nullopt; }
}

void opt_use() {
    if (auto x = parse("42")) std::cout << *x;
    int n = parse("oops").value_or(-1);
}

// VARIANT — one of a fixed set. Tagged union, no allocation.
using Shape = std::variant<class Circle, class Square, class Triangle>;
class Circle  { public: double r; };
class Square  { public: double side; };
class Triangle{ public: double a, b, c; };

double area(const Shape& s) {
    return std::visit([](const auto& shape) -> double {
        using T = std::decay_t<decltype(shape)>;
        if constexpr (std::is_same_v<T, Circle>)   return 3.14159 * shape.r * shape.r;
        if constexpr (std::is_same_v<T, Square>)   return shape.side * shape.side;
        if constexpr (std::is_same_v<T, Triangle>) return 0;       // Heron's...
    }, s);
}

// OVERLOADED VISITOR — handy idiom.
template <typename... Fs> struct overloaded : Fs... { using Fs::operator()...; };
template <typename... Fs> overloaded(Fs...) -> overloaded<Fs...>;

double area2(const Shape& s) {
    return std::visit(overloaded{
        [](const Circle&   c) { return 3.14159 * c.r * c.r; },
        [](const Square&   s) { return s.side * s.side; },
        [](const Triangle&)   { return 0.0; }
    }, s);
}

// ANY — anything goes. Heap (for big T) + RTTI for the cast.
void any_use() {
    std::any a = 42;
    std::cout << std::any_cast<int>(a);
    a = std::string("hello");                 // can change type
    std::cout << std::any_cast<const std::string&>(a);
    // any_cast<int>(a) would throw std::bad_any_cast at runtime.
}

// PERFORMANCE comparison:
//   optional<T>: no allocation. sizeof = sizeof(T) + bool (often padded).
//   variant<Ts...>: no allocation. sizeof = max(sizeof(Ts...)) + tag.
//   any:           often allocates if T doesn't fit in SBO. Runtime type-check via typeid.

// WHEN TO USE which:
//   optional → "value or nothing"
//   variant  → "one of a known set, exhaustive handling"
//   any      → "I don't know the set; type comes from somewhere else (plugin, script)"

// CAVEAT: variant has a "valueless_by_exception" state — when assignment throws midway.
// Code that assumes it's always in a valid state breaks. Guard with .valueless_by_exception().\`,
    seedQuestions: [
      "Why does std::variant cost no allocation while std::any sometimes does?",
      "What does \`std::visit\` do that an \`if/else\` chain on \`holds_alternative\` doesn't?",
      "When can a variant enter the 'valueless_by_exception' state, and what does that imply?",
      "Why is \`any\` significantly slower than variant for hot-path code?",
    ],
  },
  {
    id: "cpp-adv-fn-erasure",
    title: "std::function & Manual Type Erasure",
    difficulty: "Staff",
    icon: "🪞",
    description:
      "\`std::function<R(Args...)>\` holds any callable with that signature: free functions, lambdas, member-pointer bindings. Internally it's manual type erasure — virtual dispatch through a hidden table, small-buffer optimization for tiny captures, heap fallback for big ones. Writing your own teaches you how every type-erased interface in C++ works.",
    concepts: [
      "Type erasure = vtable + storage strategy",
      "Small-buffer optimization",
      "Move-only callables (std::move_only_function in C++23)",
      "Cost: indirection + possible allocation",
      "Hand-rolling type erasure",
    ],
    bridges: {
      Rust: "Rust's \`Box<dyn Fn>\` is the exact equivalent. Static dispatch via generics is the alternative.",
      Java: "Functional interfaces (Function<T,R>) — but Java doesn't allocate per lambda the same way.",
      Go: "func types are first-class but always heap-allocated closures.",
    },
    code: \`#include <functional>
#include <memory>
#include <utility>
#include <new>

// HAND-ROLLED type erasure for a single signature.
template <typename Sig> class fn;

template <typename R, typename... Args>
class fn<R(Args...)> {
    // The internal "interface" — virtual is the simplest erasure.
    struct Base {
        virtual R invoke(Args... a) = 0;
        virtual std::unique_ptr<Base> clone() const = 0;
        virtual ~Base() = default;
    };
    template <typename F>
    struct Holder : Base {
        F f;
        Holder(F f_) : f(std::move(f_)) {}
        R invoke(Args... a) override { return f(std::forward<Args>(a)...); }
        std::unique_ptr<Base> clone() const override { return std::make_unique<Holder>(f); }
    };

    std::unique_ptr<Base> impl_;
public:
    fn() = default;

    template <typename F>
    fn(F f) : impl_(std::make_unique<Holder<F>>(std::move(f))) {}

    fn(const fn& o) : impl_(o.impl_ ? o.impl_->clone() : nullptr) {}
    fn(fn&&) noexcept = default;

    R operator()(Args... a) const { return impl_->invoke(std::forward<Args>(a)...); }
};

// USAGE.
void demo() {
    fn<int(int,int)> add  = [](int a, int b) { return a + b; };
    fn<int(int,int)> mult = [](int a, int b) { return a * b; };
    add(2, 3); mult(2, 3);
}

// REAL std::function adds:
//   - Small-buffer optimization (no heap for small captures)
//   - target() / target_type() for inspection
//   - allocator support (deprecated in C++17, removed in C++20)
//   - Copyability requirement on the stored callable (problem for unique_ptr captures!)

// THE COPYABILITY PROBLEM.
//   std::function requires the stored callable to be COPYABLE.
//   A lambda capturing a unique_ptr is move-only.
//   std::function<...> f = [p = std::make_unique<int>(7)]() { ... };  // ERROR.

// C++23 ANSWER: std::move_only_function — same idea, no copy requirement.
//   std::move_only_function<R(Args...)> f = [p = std::make_unique<int>(7)]() { return *p; };

// WHEN NOT TO USE std::function:
//   - Hot inner loops: prefer a template parameter for static dispatch.
//   - Need stack-only storage: write your own type erasure with inline storage.

// STATIC dispatch alternative:
template <typename F>
void run_inplace(F&& f) { f(); }      // monomorphized — zero overhead\`,
    seedQuestions: [
      "What's the difference in cost between calling a lambda directly and through std::function?",
      "Why does std::function require copyability, and why does std::move_only_function exist?",
      "How does small-buffer optimization work — when does it kick in?",
      "When is type erasure the wrong tool, and what would you use instead?",
    ],
  },
  {
    id: "cpp-adv-custom-erasure",
    title: "Designing a Custom Type-Erased Interface",
    difficulty: "Staff",
    icon: "🪡",
    description:
      "When std::function isn't enough — you want to model 'any type that has these three operations' — you build a custom type-erased holder. The pattern: pure-virtual interface + concrete wrapper template. The trick: choose between virtuals (simplest), vtables of function pointers (flexible), or 'duck-typed' member calls (no inheritance needed).",
    concepts: [
      "Virtual-base type erasure",
      "Function-table type erasure",
      "Value semantics over erased types",
      "Small-buffer optimization in your own holder",
      "Sean Parent's 'Inheritance Is the Base Class of Evil'",
    ],
    bridges: {
      Rust: "trait objects (\`dyn Trait\`) are virtual-base erasure. \`&dyn Trait\` is a fat pointer = (data ptr, vtable ptr).",
      Go: "Interfaces are exactly this pattern, baked into the language.",
      Java: "Interfaces are simpler — no value semantics, all references.",
    },
    code: \`#include <memory>
#include <iostream>
#include <utility>

// TYPE-ERASE "things that can be drawn".
// Goal: a Drawable holder that owns its instance, supports value semantics,
//       and accepts any type T with \`void draw(const T&, std::ostream&)\`.

class Drawable {
    struct Concept {
        virtual ~Concept() = default;
        virtual void draw(std::ostream& os) const = 0;
        virtual std::unique_ptr<Concept> clone() const = 0;
    };

    template <typename T>
    struct Model : Concept {
        T value;
        Model(T v) : value(std::move(v)) {}
        void draw(std::ostream& os) const override { ::draw(value, os); }
        std::unique_ptr<Concept> clone() const override { return std::make_unique<Model>(value); }
    };

    std::unique_ptr<Concept> self_;

public:
    template <typename T>
    Drawable(T x) : self_(std::make_unique<Model<T>>(std::move(x))) {}

    Drawable(const Drawable& o) : self_(o.self_->clone()) {}
    Drawable(Drawable&&) noexcept = default;
    Drawable& operator=(Drawable o) noexcept { self_ = std::move(o.self_); return *this; }

    void draw(std::ostream& os) const { self_->draw(os); }
};

// User types — no inheritance, no concept, just a free function.
struct Circle { double r; };
void draw(const Circle& c, std::ostream& os) { os << "Circle r=" << c.r << '\\n'; }

struct Text { std::string s; };
void draw(const Text& t, std::ostream& os) { os << "Text: " << t.s << '\\n'; }

// USAGE.
void demo() {
    std::vector<Drawable> doc;
    doc.emplace_back(Circle{1.5});
    doc.emplace_back(Text{"hello"});
    for (auto const& d : doc) d.draw(std::cout);
    // Polymorphism without inheritance.
    // Each user type stays independent — no Drawable subclass required.
}

// THE KEY INSIGHT (Sean Parent):
//   - Polymorphism is a property of the algorithm, not the type.
//   - Don't force user types to inherit. Let your interface erase the type.
//   - Composition over inheritance: a holder OWNS its concept.

// ALTERNATIVE: function-table erasure (no virtuals).
struct DrawableV2 {
    void* obj;
    void (*draw_fn)(const void*, std::ostream&);
    void (*delete_fn)(void*);
    template <typename T>
    static DrawableV2 make(T* p) {
        return {p,
                [](const void* o, std::ostream& os) { draw(*static_cast<const T*>(o), os); },
                [](void* o)                          { delete static_cast<T*>(o); }};
    }
};
// Use case: lower-overhead, easier to embed in C ABIs, but value semantics get harder.\`,
    seedQuestions: [
      "What does the 'concept / model' pair pattern buy you over plain virtual base classes?",
      "Why does this design let user types like Circle stay completely independent of Drawable?",
      "When would function-table erasure beat virtual-table erasure?",
      "How would you add small-buffer optimization to Drawable — what changes?",
    ],
  },
] };
