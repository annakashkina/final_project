export const cppConstexpr = { name: "Compile-time Programming", lessons: [
  {
    id: "cpp-adv-constexpr-tiers",
    title: "constexpr, consteval, constinit",
    difficulty: "Advanced",
    icon: "⏱️",
    description:
      "Three keywords stake out the compile-time/runtime boundary. `constexpr` (may be compile time, must be valid at compile time when used so). `consteval` (must be compile time, ever). `constinit` (variable must be constant-initialized — fixes the static initialization order fiasco). Picking the right one is part of the type-system contract.",
    concepts: [
      "constexpr functions and variables",
      "consteval functions (C++20)",
      "constinit variables (C++20)",
      "Constant expression rules",
      "Static initialization order fiasco fix",
    ],
    bridges: {
      Rust: "Rust has const fn and static; constinit's role is implicit because const items must be const-initializable.",
      D: "static-if + CTFE play the role of constexpr.",
      Java: "Compile-time constants only for primitives via `static final`. Far less powerful.",
    },
    code: `#include <type_traits>
#include <string_view>

// CONSTEXPR — may be evaluated at compile time. Still callable at runtime.
constexpr int factorial(int n) {
    int r = 1;
    for (int i = 2; i <= n; ++i) r *= i;
    return r;
}

constexpr int F5 = factorial(5);                 // compile-time → 120
int n = 7;
int dyn = factorial(n);                          // runtime — same function

// CONSTEVAL (C++20) — MUST be evaluated at compile time. No runtime calls.
consteval int square_at_compile(int x) { return x * x; }

constexpr int q = square_at_compile(7);          // OK
// int n = 5; int q2 = square_at_compile(n);     // ERROR: requires compile-time arg

// CONSTINIT (C++20) — variable must be CONSTANT-INITIALIZED.
//   Doesn't make it const; allows further mutation.
//   Solves the "static initialization order fiasco" for globals.

extern int compute();                            // not constexpr
// constinit int bad = compute();                // ERROR: not constant-initialized
constinit int counter = 0;                       // OK — zero-init is constant
void tick() { counter++; }                       // OK to mutate at runtime

// THE STATIC INIT ORDER FIASCO:
//   Two globals in different TUs: a depends on b; their relative init order is unspecified.
//   With constinit b = ...;
//     b is guaranteed initialized before any dynamic init runs anywhere.
//   a can then safely read b at startup.

// CONSTEXPR variables are implicitly constinit + const.

// CONSTANT EXPRESSION rules (key constraints):
//   - No undefined behavior anywhere along the evaluation path.
//   - No throw of an unhandled exception (until C++26 expects loosening).
//   - No new/delete that isn't paired (allowed since C++20 with restrictions).
//   - No reinterpret_cast, no goto into the middle of init, ...
//   - virtual calls OK if the dynamic type is statically known.

// IF CONSTEXPR (C++17) — compile-time branch inside a constexpr OR runtime function.
template <typename T>
auto describe(T x) {
    if constexpr (std::is_integral_v<T>)        return std::string_view{"int"};
    else if constexpr (std::is_floating_point_v<T>) return std::string_view{"float"};
    else                                        return std::string_view{"other"};
}
// Each \`if constexpr\` discards the other branches at instantiation — no warnings, no compile cost.\`,
    seedQuestions: [
      "Walk through: when MUST a \`constexpr\` function evaluate at compile time, and when CAN it?",
      "What does \`consteval\` rule out that \`constexpr\` does not?",
      "What is the static initialization order fiasco, and how does \`constinit\` fix it?",
      "Why does \`if constexpr\` produce different code than a regular \`if\` in a template?",
    ],
  },
  {
    id: "cpp-adv-constexpr-containers",
    title: "constexpr Containers & Algorithms",
    difficulty: "Staff",
    icon: "📐",
    description:
      "C++20 made \`std::vector\` and \`std::string\` constexpr — allocation and deallocation are now allowed during constant evaluation (as long as everything is freed before the expression ends). Combined with constexpr <algorithm>, you can compute lookup tables, parsed grammars, and even small databases entirely at compile time.",
    concepts: [
      "constexpr allocation rules",
      "Transient allocation during constant evaluation",
      "constexpr std::string, std::vector (C++20)",
      "Compile-time table generation",
      "Limits: no I/O, no non-constexpr deps",
    ],
    bridges: {
      Rust: "Rust const fn is more limited; allocation in const contexts is unstable.",
      D: "CTFE allows almost anything that doesn't touch the OS — closest analog.",
      Zig: "comptime is the equivalent and arguably the most ergonomic version.",
    },
    code: \`#include <vector>
#include <string>
#include <array>
#include <algorithm>
#include <numeric>

// COMPILE-TIME computation using constexpr std::vector (C++20).
constexpr int sum_squares(int n) {
    std::vector<int> v(n);
    std::iota(v.begin(), v.end(), 1);
    return std::accumulate(v.begin(), v.end(), 0, [](int a, int b){ return a + b*b; });
}
constexpr int s = sum_squares(10);              // 385, computed at compile time

// RULE: any allocation must be FREED before the constant expression completes.
//   Returning a constexpr std::vector from a constexpr function is NOT allowed —
//   the allocation would outlive the constant expression.
//
// Workaround: convert to a fixed std::array (no allocation).

constexpr auto first_n_primes() {
    std::array<int, 10> primes{};
    int count = 0, n = 2;
    while (count < 10) {
        bool is_prime = true;
        for (int i = 2; i * i <= n; ++i) {
            if (n % i == 0) { is_prime = false; break; }
        }
        if (is_prime) primes[count++] = n;
        ++n;
    }
    return primes;
}
constexpr auto PRIMES = first_n_primes();       // baked into the binary

// COMPILE-TIME parsing — common pattern for format strings.
constexpr int count_args(std::string_view fmt) {
    int n = 0;
    for (std::size_t i = 0; i + 1 < fmt.size(); ++i) {
        if (fmt[i] == '{' && fmt[i+1] == '}') ++n;
    }
    return n;
}
static_assert(count_args("hello {}, you are {} years old") == 2);

// std::format uses this trick: format strings are parsed at compile time
// and bad format strings become compile errors.

// LIMITS of compile-time evaluation:
//   - No I/O at all (no files, no sockets).
//   - No non-constexpr functions (typeid on polymorphic objects, atomic ops...).
//   - No virtual calls if dynamic type is not statically known.
//   - All memory must be freed before evaluation ends.
//   - No undefined behavior; UB makes the program ill-formed.

// PRACTICAL USE CASES:
//   - Lookup tables: sin, log, CRC.
//   - Compile-time RegEx (CTRE library).
//   - Parsing of format strings, JSON Schema, IDL.
//   - Hashing literals into IDs.
//   - Compile-time graphs for type-safe state machines.\`,
    seedQuestions: [
      "Why can't you return a \`constexpr std::vector\` from a constexpr function and store it in a constexpr variable?",
      "Why does converting to \`std::array\` work where vector doesn't?",
      "What category of bugs becomes a compile error when format strings are parsed at compile time?",
      "What kinds of work can never run during constant evaluation, even with C++26 relaxations?",
    ],
  },
  {
    id: "cpp-adv-nttp-strings",
    title: "Compile-time Strings & Reflection-Like Patterns",
    difficulty: "Staff",
    icon: "📜",
    description:
      "C++20 class-type NTTPs unlocked compile-time strings as template parameters. Combined with constexpr parsing, this gives you the ingredients for compile-time DSLs, statically-checked formats, and prototyping the patterns that full reflection (C++26+) will eventually formalize.",
    concepts: [
      "Compile-time string templates",
      "Static reflection direction (C++26)",
      "Static checking of structural invariants",
      "Compile-time identifiers as types",
      "Boost.Hana / Boost.PFR for current 'reflection'",
    ],
    bridges: {
      Rust: "proc-macros enable similar compile-time DSLs but at a higher cost.",
      D: "Native compile-time reflection.",
      Zig: "@typeInfo gives full compile-time reflection — what C++ is moving toward.",
    },
    code: \`#include <array>
#include <string_view>
#include <algorithm>

// Fixed-size string usable as NTTP.
template <std::size_t N>
struct FixedString {
    char data[N]{};
    constexpr FixedString(const char (&s)[N]) {
        std::copy_n(s, N, data);
    }
    constexpr std::string_view view() const { return {data, N - 1}; }
};
template <std::size_t N> FixedString(const char (&)[N]) -> FixedString<N>;

// TAG type carrying a compile-time string.
template <FixedString S>
struct Tag {
    static constexpr std::string_view name = S.view();
};

using Cm = Tag<"centimeter">;
using In = Tag<"inch">;
static_assert(Cm::name == "centimeter");
static_assert(!std::is_same_v<Cm, In>);          // different types

// COMPILE-TIME-CHECKED FORMAT STRINGS (concept sketch).
template <FixedString Fmt>
consteval int count_braces() {
    int n = 0;
    for (char c : Fmt.view()) if (c == '{') ++n;
    return n;
}

template <FixedString Fmt, typename... Args>
constexpr void format_check() {
    static_assert(count_braces<Fmt>() == sizeof...(Args),
                  "argument count doesn't match format string");
}

void demo() {
    format_check<"hello {} you are {}">(1, 2);            // OK
    // format_check<"hello {}">(1, 2);                     // COMPILE ERROR with clear message
}

// COMPILE-TIME REFLECTION via Boost.PFR / Aggregate destructuring.
//   pfr::for_each_field(struct, [](auto& f) { ... })
//   Internally uses structured bindings and constexpr loops.

// FORWARD-LOOKING C++26: static reflection (P2996) is expected to land.
// You'll be able to query members of a type, build serializers, generate code, etc.
//   - For now, the FixedString-NTTP trick covers ~80% of named-key DSL needs.

// EXAMPLE: a unit-checked quantity using compile-time strings as units.
template <typename T, FixedString Unit>
struct Quantity {
    T value;
};
constexpr Quantity<double, "meters">   m{3.0};
constexpr Quantity<double, "seconds">  s{1.5};
// constexpr auto bad = m + s;   // could be made a compile error via concept on Unit

// LESSON: compile-time strings turn type-system parameters into a true DSL.
// You can encode names, units, paths, keys — and use them in static_assert.\`,
    seedQuestions: [
      "How does \`FixedString<\"meters\">\` end up as a part of a type rather than a runtime value?",
      "What's the practical benefit of compile-time format string checking over runtime?",
      "How would static reflection (C++26) replace the patterns shown here?",
      "Why can two \`Tag<\"x\">\` instances with the same string be the SAME type — what does that buy you?",
    ],
  },
] };
