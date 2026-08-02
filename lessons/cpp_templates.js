export const cppTemplates = { name: "Templates", lessons: [
  {
    id: "cpp-adv-fn-templates",
    title: "Function Templates: Deduction & Overloading",
    difficulty: "Core",
    icon: "🧩",
    description:
      "Function templates parameterize code over types and constants. Deduction figures out the template arguments from the call. Overload resolution picks among templates and non-templates by a precise ranking. Understanding deduction failure modes is half of writing good generic code.",
    concepts: [
      "Template argument deduction phases",
      "Non-deduced contexts",
      "Overload between template and non-template",
      "Explicit template arguments and partial specification",
      "Function template parameter packs",
    ],
    bridges: {
      Rust: "Rust generics also infer type parameters but resolve to one impl. C++ has overload sets across templates and non-templates.",
      Java: "Java generics use type erasure — no monomorphization, no specialization, no concept of 'overload resolution between generic and non-generic'.",
      Python: "Duck typing skips all of this; everything is dynamic. C++ moves the same work to compile time.",
    },
    code: `#include <type_traits>
#include <vector>
#include <string>

// Plain function template.
template <typename T>
T const& min_of(T const& a, T const& b) { return a < b ? a : b; }

// Non-template overload — preferred when types match exactly.
int min_of(int a, int b) { return a < b ? a : b; }

// NON-DEDUCED CONTEXTS: T appears, but the compiler can't deduce from this position.
template <typename T> using Identity = T;

template <typename T>
void cannot_deduce(Identity<T> x);     // T is non-deduced here

void demo_deduce() {
    cannot_deduce(42);                 // ERROR: T not deducible
    cannot_deduce<int>(42);            // OK: explicit
}

// EXPLICIT and PARTIAL template arguments.
template <typename Ret, typename Arg>
Ret cast_to(Arg a) { return static_cast<Ret>(a); }

int x = cast_to<int>(3.14);            // Ret=int explicit, Arg=double deduced

// DEDUCTION on references and cv-qualifiers (forwarding excluded):
template <typename T> void by_value(T);
template <typename T> void by_ref(T&);

void cv_demo() {
    const int n = 0;
    by_value(n);                       // T = int (cv dropped on value)
    by_ref(n);                         // T = const int
}

// Variadic function template.
template <typename... Args>
auto sum(Args... args) { return (args + ...); }    // fold expression

// Mixing template and non-template overloads:
template <typename T> void take(T)        { /* generic */ }
                       void take(int)     { /* exact-match non-template wins */ }
                       void take(double)  { /* same */ }

// Overload ranking among templates: more specialized wins.
template <typename T> void rank(T);
template <typename T> void rank(T*);              // more specialized for pointers
template <typename T> void rank(const T*);        // most specialized for const ptrs

void test() {
    int   i;  rank(i);                 // first overload
    int*  p;  rank(p);                 // second
    const int* cp; rank(cp);           // third\`,
    seedQuestions: [
      "What is a non-deduced context and why does it exist?",
      "When the compiler has both a template and a non-template overload, which wins and why?",
      "How does the 'more specialized' ranking decide between two template overloads?",
      "Why does \`by_value(n)\` drop the const but \`by_ref(n)\` keep it?",
    ],
  },
  {
    id: "cpp-adv-class-templates",
    title: "Class Templates & Partial Specialization",
    difficulty: "Advanced",
    icon: "📦",
    description:
      "Class templates can be fully or partially specialized — function templates cannot. Partial specialization is how the standard library expresses 'shared_ptr<T[]> behaves differently from shared_ptr<T>' and 'std::is_pointer<T*> is true'. Mastering the ordering rules unlocks most of the metaprogramming toolkit.",
    concepts: [
      "Primary template vs specialization",
      "Partial specialization on pointers, references, const",
      "Why function templates can't partially specialize",
      "Ordering of partial specializations",
      "Variable templates (C++14)",
    ],
    bridges: {
      Rust: "Rust impls play the role of partial specialization. Specialization in Rust is unstable.",
      Java: "No specialization in Java generics. Behavior diverges by runtime type, not compile time.",
      Haskell: "Type class instances with overlapping pragmas — closest analog. The dispatch ranking ideas are similar.",
    },
    code: \`#include <type_traits>

// Primary template.
template <typename T>
struct is_pointer_like { static constexpr bool value = false; };

// Partial specialization for raw pointers.
template <typename T>
struct is_pointer_like<T*> { static constexpr bool value = true; };

// More partial specializations.
template <typename T> struct is_pointer_like<T* const>          { static constexpr bool value = true; };
template <typename T> struct is_pointer_like<T* volatile>       { static constexpr bool value = true; };
template <typename T> struct is_pointer_like<T* const volatile> { static constexpr bool value = true; };

static_assert(is_pointer_like<int*>::value);
static_assert(is_pointer_like<int* const>::value);
static_assert(!is_pointer_like<int>::value);

// VARIABLE TEMPLATE — same pattern, one-line form (C++14).
template <typename T>           constexpr bool is_ptr_v        = false;
template <typename T>           constexpr bool is_ptr_v<T*>    = true;

// ORDERING: when multiple partial specializations match, the MOST SPECIALIZED wins.
template <typename T>   struct S { static constexpr int v = 1; };  // primary
template <typename T>   struct S<T*>          { static constexpr int v = 2; };
template <typename T>   struct S<const T*>    { static constexpr int v = 3; };  // more specialized

static_assert(S<int>::v       == 1);
static_assert(S<int*>::v      == 2);
static_assert(S<const int*>::v == 3);   // not 2

// WHY FUNCTION TEMPLATES CAN'T PARTIALLY SPECIALIZE:
// Overload resolution already handles function selection.
// Allowing partial specialization too would create ambiguity between
// "specialization picked first, then overload" vs "overload, then specialization".
// Workaround: dispatch via a class template, or use overloads.

template <typename T>
struct max_impl { static T call(T a, T b) { return a < b ? b : a; } };

template <typename T>
T max_(T a, T b) { return max_impl<T>::call(a, b); }
// Now you can SPECIALIZE max_impl for specific T's.

// CLASS TEMPLATE specialization is also full specialization:
template <>
struct max_impl<const char*> {
    static const char* call(const char* a, const char* b) {
        return std::strcmp(a, b) < 0 ? b : a;
    }
};`,
    seedQuestions: [
      "Why are function templates barred from partial specialization but class templates allowed?",
      "How does the compiler decide which partial specialization is 'most specialized'?",
      "What's the difference between full specialization and partial specialization?",
      "Why is the variable template form `is_ptr_v` more ergonomic than the struct form?",
    ],
  },
  {
    id: "cpp-adv-nttp",
    title: "Non-Type Template Parameters",
    difficulty: "Advanced",
    icon: "🔢",
    description:
      "Templates can be parameterized by VALUES, not just types — integers, enums, pointers to functions, and (since C++20) literal class types like strings and arrays. NTTPs power std::array's size, std::bitset, and the compile-time string trick that drives constexpr formatting.",
    concepts: [
      "Integer/enum NTTPs",
      "auto NTTPs (C++17)",
      "Class-type NTTPs (C++20)",
      "Compile-time strings as NTTPs",
      "Templates parameterized by member pointers",
    ],
    bridges: {
      Rust: "Rust's const generics (stable 2024 for primitives, partial for ADTs) mirror NTTPs. C++ went further with literal class types in C++20.",
      Java: "No analog. Java generics are types only.",
      D: "D has template value parameters with similar reach.",
    },
    code: `#include <cstddef>
#include <array>
#include <string_view>
#include <algorithm>

// Classic: array of fixed size.
template <typename T, std::size_t N>
struct FixedArray { T data[N]; };

FixedArray<int, 8> a{};                  // N is part of the type

// AUTO NTTPs (C++17): deduce the value's type.
template <auto V>
struct Constant { static constexpr auto value = V; };

using Five    = Constant<5>;             // V: int
using Bee     = Constant<'b'>;           // V: char
using PtrFun  = Constant<&std::puts>;    // V: int(*)(const char*)

// CLASS-TYPE NTTPs (C++20). The type must be a "structural type".
struct Point { int x, y; };              // structural: public, all-literal
template <Point P>
struct AtPoint {};

AtPoint<Point{3, 4}> p;                  // OK

// COMPILE-TIME STRINGS via NTTP.
template <std::size_t N>
struct FixedString {
    char data[N]{};
    constexpr FixedString(const char (&s)[N]) {
        std::copy_n(s, N, data);
    }
    constexpr std::string_view view() const { return {data, N - 1}; }
};

// Deduction guide so FixedString<"hello"> works.
template <std::size_t N> FixedString(const char (&)[N]) -> FixedString<N>;

template <FixedString Name>
struct Tagged {
    static constexpr auto name = Name.view();
};

using T1 = Tagged<"alpha">;
using T2 = Tagged<"beta">;
// T1 and T2 are DIFFERENT TYPES — the string is part of the type.

// MEMBER POINTERS as NTTPs.
struct Foo { int x; };
template <auto Mem>
auto& get_member(Foo& f) { return f.*Mem; }

Foo f{42};
auto& r = get_member<&Foo::x>(f);        // r aliases f.x

// COMPILE-TIME FORMAT STRINGS — a real C++20 trick.
// std::format uses this so format strings are parsed at compile time
// and bad format strings become compile errors.\`,
    seedQuestions: [
      "What is a 'structural type' and why is it required for class-type NTTPs?",
      "How does FixedString<\"hello\"> achieve the seemingly impossible — strings as template arguments?",
      "Why does using a different literal create a different type, and what does that buy you?",
      "What can you do with member pointers as NTTPs that you can't easily do otherwise?",
    ],
  },
  {
    id: "cpp-adv-template-template",
    title: "Template Template Parameters & Higher-Order Templates",
    difficulty: "Staff",
    icon: "🪆",
    description:
      "A template can take another template as a parameter — without committing to specific type arguments yet. This is how you write generic algorithms over container CATEGORIES rather than container TYPES: 'works with any associative container', 'works with any sequence container'. Power: high. Use: rarer than you think, because deduction is fragile.",
    concepts: [
      "Template template parameter syntax",
      "Variadic template template parameters",
      "Default arguments and matching",
      "Why deduction often fails — use auto with concepts instead",
      "Detection of container categories",
    ],
    bridges: {
      Rust: "Rust HKT (higher-kinded types) are limited; the closest pattern is GATs (generic associated types).",
      Haskell: "Type constructors of higher kind are first-class. C++ template templates aim for similar but with restrictions.",
      Java: "No analog.",
    },
    code: \`#include <vector>
#include <list>
#include <deque>
#include <map>
#include <type_traits>

// Function generic over the CONTAINER CATEGORY.
template <template <typename, typename> class Container, typename T, typename A>
T sum(const Container<T, A>& c) {
    T s{};
    for (auto const& x : c) s += x;
    return s;
}

void usage() {
    std::vector<int> v{1, 2, 3};
    std::list<int>   l{4, 5, 6};
    std::deque<int>  d{7, 8, 9};
    sum(v); sum(l); sum(d);
}

// VARIADIC template template — matches containers with any number of args.
template <template <typename...> class Container, typename T>
auto length(const Container<T>& c) -> typename Container<T>::size_type {
    return c.size();
}

// DEDUCTION FAILS more often than you'd hope. Example:
// std::map<K, V> actually has 4 template parameters (K, V, Comp, Alloc).
// A \`template <template <typename, typename> class>\` parameter won't match.
// Workaround: variadic. Or just use \`template <class C>\` + concepts.

template <typename C>
auto better_sum(const C& c) {
    using T = typename C::value_type;
    T s{};
    for (auto const& x : c) s += x;
    return s;
}
// In C++20, prefer:
//   template <std::ranges::range R>
//   auto better_sum(const R& r) { ... }
// Concepts subsume template template parameters for most use cases.

// REAL USE CASE: detecting container category at compile time.
template <template <typename...> class>
struct is_associative : std::false_type {};
template <>
struct is_associative<std::map> : std::true_type {};
template <>
struct is_associative<std::unordered_map> : std::true_type {};

// Now compile-time dispatch on category:
template <typename C>
void dump(const C&) requires (!is_associative<???>::value) { /* sequence */ }
// ... (in practice: use concepts on the value_type / key_type presence)

// RULE OF THUMB: prefer \`typename C\` + a concept like \`std::ranges::range\`
// over a template template parameter. Use TTP only when you really need
// to talk about the container template itself (e.g., rebinding).\`,
    seedQuestions: [
      "Why does the variadic version match more containers than the fixed-arity version?",
      "What goes wrong if you write \`template <template<typename> class C>\` and try to pass std::vector?",
      "Why are concepts often a better choice than template template parameters?",
      "Give one use case where a template template parameter is still the right tool.",
    ],
  },
] };
