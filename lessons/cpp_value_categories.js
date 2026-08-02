export const cppValueCategories = { name: "Value Categories", lessons: [
  {
    id: "cpp-adv-value-cats",
    title: "lvalue, rvalue, xvalue, prvalue",
    difficulty: "Core",
    icon: "🏷️",
    description:
      "Every C++ expression has a type AND a value category. Categories control what can bind to a reference, what can be moved from, and when temporaries materialize. Modern C++ has five categories arranged in a small lattice.",
    concepts: [
      "glvalue = lvalue ∪ xvalue (has identity)",
      "rvalue = xvalue ∪ prvalue (movable)",
      "prvalue: pure rvalue, no identity yet",
      "xvalue: eXpiring value, identity + movable",
      "decltype and category interplay",
    ],
    bridges: {
      Rust: "Rust has 'place' vs 'value' expressions — analogous to glvalue vs prvalue. Move semantics in Rust = xvalue conversion in C++.",
      Java: "Java has no equivalent. Every Java expression is essentially an lvalue (a reference) or a primitive. C++ needs categories because objects can be values too.",
      C: "C has lvalues and 'non-lvalues'. C++ split non-lvalues into the four-way taxonomy so move semantics could be expressed in the type system.",
    },
    code: `#include <utility>
#include <type_traits>

int  glob = 0;
int& get_ref()  { return glob; }      // returns lvalue
int  get_val()  { return 42; }        // returns prvalue
int&& get_xref() { return std::move(glob); } // returns xvalue

struct S { int v; };
S make_s() { return S{}; }

void demo() {
    int x = 0;
    // lvalue: has a name, has identity
    int& a = x;                       // OK
    // int& b = 42;                   // ERROR: cannot bind to prvalue
    const int& c = 42;                // OK: const lvalue ref binds to prvalue

    // prvalue: result of a computation, no identity yet
    int  p = x + 1;                   // (x+1) is prvalue

    // xvalue: lvalue cast to rvalue via std::move
    int&& r = std::move(x);           // r is an lvalue REFERRING to an xvalue
    static_assert(std::is_same_v<decltype((std::move(x))), int&&>);

    // Function call categories
    static_assert(std::is_lvalue_reference_v<decltype(get_ref())>);   // lvalue
    static_assert(std::is_same_v<decltype(get_val()), int>);          // prvalue
    static_assert(std::is_rvalue_reference_v<decltype(get_xref())>);  // xvalue

    // decltype on a NAME vs an EXPRESSION
    int y = 0;
    static_assert(std::is_same_v<decltype(y), int>);     // declared type
    static_assert(std::is_same_v<decltype((y)), int&>);  // (y) is an lvalue expr

    // Member access keeps the parent's category
    S s;
    static_assert(std::is_same_v<decltype((s.v)),       int&>);     // lvalue
    static_assert(std::is_same_v<decltype((make_s().v)), int&&>);   // xvalue!
}`,
    seedQuestions: [
      "Why is `std::move(x)` an xvalue and not a prvalue?",
      "What does it mean that prvalues 'have no identity yet' — what changes when they materialize?",
      "Why does `decltype(y)` give `int` but `decltype((y))` give `int&`?",
      "Why can `const int&` bind to `42` but plain `int&` cannot?",
    ],
  },
  {
    id: "cpp-adv-copy-elision",
    title: "Copy Elision, RVO & NRVO",
    difficulty: "Core",
    icon: "✂️",
    description:
      "Since C++17, prvalues are NOT objects until they materialize — so returning a prvalue is guaranteed zero-copy. NRVO (returning a named local) is still optional but ubiquitous. Knowing the rules tells you when a copy/move actually happens.",
    concepts: [
      "Mandatory elision for prvalues (C++17)",
      "NRVO for named locals (optional)",
      "Why a deleted copy ctor still compiles for return",
      "Elision and conditional returns",
      "Diagnosing missed elision",
    ],
    bridges: {
      Rust: "Rust always moves by default and the optimizer handles trivial cases. C++ split this into 'guaranteed mandatory' (prvalues) and 'allowed optional' (NRVO).",
      Java: "Java returns references, so there's nothing to elide. The whole concept is unique to value-semantic languages.",
      C: "C has no copy constructor, so 'elision' isn't a category — but the same struct-return ABI rules apply (returning into caller-provided slot).",
    },
    code: `#include <iostream>
#include <string>

struct Loud {
    std::string tag;
    Loud(const char* t) : tag(t)         { std::cout << "ctor "  << tag << '\\n'; }
    Loud(const Loud& o)  : tag(o.tag+"c"){ std::cout << "copy "  << tag << '\\n'; }
    Loud(Loud&& o) noexcept : tag(std::move(o.tag)+"m"){ std::cout << "move " << tag << '\\n'; }
    ~Loud()                              { std::cout << "~"     << tag << '\\n'; }
};

// Returning a prvalue → MANDATORY elision since C++17.
// No copy, no move — even if both are deleted.
Loud factory_prvalue() {
    return Loud("a");          // prints only "ctor a"
}

// Returning a named local → NRVO (optional but typical).
Loud factory_nrvo() {
    Loud x("b");
    return x;                  // usually: just "ctor b"
}

// Conditional returns DEFEAT NRVO — two different objects.
Loud factory_branch(bool cond) {
    Loud x("x"), y("y");
    return cond ? x : y;       // implicit move from lvalue
}

// Tricky: std::move on return DISABLES NRVO.
Loud pessimized() {
    Loud x("z");
    return std::move(x);       // forces a move; NRVO would have been free
}

int main() {
    auto a = factory_prvalue();
    auto b = factory_nrvo();
    auto c = factory_branch(true);
    auto d = pessimized();
}`,
    seedQuestions: [
      "Why does mandatory elision work even with a deleted copy/move constructor?",
      "Why does `return std::move(x)` make things slower, not faster?",
      "What breaks NRVO — conditional returns, multiple return paths, what else?",
      "What does 'a prvalue is not yet an object' actually mean physically?",
    ],
  },
  {
    id: "cpp-adv-lifetime-ext",
    title: "Lifetime Extension",
    difficulty: "Core",
    icon: "⏳",
    description:
      "Binding a temporary to a const lvalue reference (or rvalue reference) extends its lifetime to that of the reference. The rule is narrower than people think — it does NOT extend through function returns or member sub-references. Misuse here is one of C++'s sharpest footguns.",
    concepts: [
      "Reference-to-temporary extends lifetime",
      "Does not extend through function returns",
      "Subobject binding pitfalls",
      "Range-for over a function-returned range",
      "auto&& as 'forwarding reference for locals'",
    ],
    bridges: {
      Rust: "Rust's borrow checker prevents reference-to-temporary outliving the temporary. C++ tries to extend the lifetime, then fails silently if the pattern is wrong.",
      Java: "Java has no temporaries to dangle — everything is heap with GC. The whole category of bug doesn't exist there.",
      Python: "Python keeps objects alive while named. C++ kills them at end-of-statement unless bound — a category of bug Python users don't face.",
    },
    code: `#include <string>
#include <vector>
#include <iostream>

std::string make() { return "hello"; }

void ok() {
    const std::string& s = make();    // OK: lifetime extended to end of scope
    std::cout << s << '\\n';
}

// FOOTGUN: temporary bound through a chain — extension does NOT propagate.
const std::string& get_part() {
    return make();                    // dangles! temporary dies at return
}

// FOOTGUN: range-for evaluates the range expression as a hidden ref.
std::vector<int> get_vec() { return {1, 2, 3}; }

void range_for_ok() {
    for (int x : get_vec()) {         // OK: rvalue bound to hidden ref
        std::cout << x << ' ';
    }
}

struct Holder {
    std::vector<int> data{10, 20, 30};
    const std::vector<int>& as_ref() const { return data; }
};

void range_for_subtle() {
    // BAD: Holder{} dies after .as_ref() returns; the reference dangles
    // before the loop body even runs.
    // for (int x : Holder{}.as_ref()) { ... }   // UB

    // Fix: bind the parent to a local first.
    Holder h;
    for (int x : h.as_ref()) std::cout << x << ' ';
}

// auto&& as 'whatever the expression gives us, kept alive locally'
void universal_local() {
    auto&& s = make();                // extends lifetime, like const ref
    auto&& t = []{ static std::string s = "x"; return s; }();
    // works for both prvalues (extends) and lvalues (just binds)
    std::cout << s << ' ' << t << '\\n';
}`,
    seedQuestions: [
      "Why does `const T& r = make();` extend lifetime but returning `make()` by const ref does not?",
      "What exactly is the hidden variable in a range-for loop?",
      "Why does `Holder{}.as_ref()` dangle before the loop runs?",
      "When would you prefer `auto&&` over `const auto&` for a local binding?",
    ],
  },
  {
    id: "cpp-adv-temp-materialization",
    title: "Temporary Materialization",
    difficulty: "Advanced",
    icon: "✨",
    description:
      "C++17 introduced a new conversion: prvalue → xvalue, called temporary materialization. A prvalue has no storage; it only becomes a 'thing in memory' when you do something that needs it — like take a reference, access a member, or pass it through a function. Understanding this clarifies elision, slicing, and many template puzzles.",
    concepts: [
      "Prvalue → xvalue conversion",
      "When materialization happens",
      "Connection to mandatory elision",
      "decltype interplay",
      "Object slicing via materialization",
    ],
    bridges: {
      Rust: "Rust doesn't model 'unmaterialized' values; everything has a stack slot or register. C++ exposes the distinction so guaranteed elision is expressible.",
      Java: "All objects are heap. There's no 'unmaterialized' state — `new T()` immediately produces a reference.",
      C: "C's compound literals (`(struct S){...}`) are closer to prvalues, but C has no formal materialization concept.",
    },
    code: `#include <type_traits>
#include <utility>

struct Big { int data[1000]; };

Big make_big() { return Big{}; }       // returns prvalue

template <typename T>
void take_ref(const T& t);             // accepts any expression

void demo() {
    // make_big() is a prvalue — no storage yet.
    // The result is materialized into the storage of \`b\` directly.
    Big b = make_big();                // no copy, no move, no temporary object

    // Materialization happens when you take a reference:
    take_ref(make_big());              // prvalue → xvalue, materialized

    // Member access on a prvalue also materializes:
    int first = make_big().data[0];    // a temporary exists for one expression

    // decltype distinguishes:
    static_assert(std::is_same_v<decltype(make_big()),         Big>);   // prvalue
    static_assert(std::is_same_v<decltype((make_big())),       Big>);   // still prvalue
    // But once we name it, it's an lvalue:
    static_assert(std::is_same_v<decltype((b)),                Big&>);
}

// Why this matters: returning a prvalue of a non-movable type works.
struct Locked {
    Locked() = default;
    Locked(const Locked&) = delete;
    Locked(Locked&&) = delete;
};

Locked make_locked() { return Locked{}; }   // OK in C++17
// Locked l = make_locked();                // OK: no copy/move needed
//                                          //     materialization is direct construction

// Slicing puzzle: which destructor runs?
struct Base { virtual ~Base() = default; virtual const char* who() const { return "Base"; } };
struct Derived : Base { const char* who() const override { return "Derived"; } };

Derived make_derived() { return {}; }

void slice() {
    Base b = make_derived();           // SLICED: Derived prvalue materialized
    // b.who() returns "Base"          //   into a Base-sized slot. Derived part lost.
}`,
    seedQuestions: [
      "What does it mean physically for a prvalue to 'not have storage' before materialization?",
      "How does materialization enable returning a non-copyable, non-movable type?",
      "Why is `decltype(make_big())` still `Big` and not `Big&&`?",
      "In `slice()`, when does the slicing actually occur — at return, at materialization, or at construction?",
    ],
  },
] };
