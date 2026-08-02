export const cppDeduction = { name: "Type Deduction", lessons: [
  {
    id: "cpp-adv-auto-decltype",
    title: "auto, decltype, decltype(auto)",
    difficulty: "Core",
    icon: "🎯",
    description:
      "C++ has three subtly different deduction modes: `auto` (template-style, drops references and cv), `decltype` (expression-driven, keeps everything), and `decltype(auto)` (auto's syntax with decltype's rules). Picking the right one is the difference between accidentally copying and correctly aliasing.",
    concepts: [
      "auto deduction = template deduction by value",
      "decltype(expr) preserves value category",
      "decltype((x)) vs decltype(x)",
      "decltype(auto) for forwarding functions",
      "Common pitfalls in return-type deduction",
    ],
    bridges: {
      Rust: "Rust's `let x = expr` is closer to auto; expression types are determined by inference. No decltype equivalent.",
      Haskell: "Type inference subsumes both; no distinction between value-category modes.",
      Java: "`var` (Java 10+) deduces like auto. No equivalent to decltype.",
    },
    code: `#include <type_traits>
#include <utility>
#include <vector>

int  global = 0;
int& by_ref()  { return global; }
int  by_val()  { return 42; }

void demo() {
    int x = 0;
    int& rx = x;

    // auto: drops references and cv. Equivalent to template T deduction by value.
    auto a1 = x;            // int
    auto a2 = rx;           // int (NOT int&)
    auto a3 = by_ref();     // int (NOT int&)
    static_assert(std::is_same_v<decltype(a3), int>);

    // auto& / const auto& preserve reference.
    auto& a4 = by_ref();    // int&

    // auto&& is forwarding (universal) — keeps value category.
    auto&& a5 = by_ref();   // int&
    auto&& a6 = by_val();   // int&&

    // decltype on a NAMED VARIABLE: its declared type.
    static_assert(std::is_same_v<decltype(x),  int>);
    static_assert(std::is_same_v<decltype(rx), int&>);

    // decltype on an EXPRESSION: type + value category encoded.
    //   lvalue  → T&
    //   xvalue  → T&&
    //   prvalue → T
    static_assert(std::is_same_v<decltype((x)),       int&>);   // (x) is lvalue expr
    static_assert(std::is_same_v<decltype(by_ref()),  int&>);   // lvalue
    static_assert(std::is_same_v<decltype(by_val()),  int>);    // prvalue
    static_assert(std::is_same_v<decltype(std::move(x)), int&&>); // xvalue

    // decltype(auto): use auto's syntax with decltype's rules.
    decltype(auto) d1 = x;        // int
    decltype(auto) d2 = (x);      // int& — parentheses make it an expression!
    decltype(auto) d3 = by_ref(); // int&
    decltype(auto) d4 = by_val(); // int
}

// PRACTICAL: a perfect forwarding-return wrapper.
template <typename F, typename... Args>
decltype(auto) call(F&& f, Args&&... args) {
    return std::forward<F>(f)(std::forward<Args>(args)...);
    //     ^ if F returns int&, we return int&. auto would have returned int (copy!).
}

// PITFALL: return type auto deduction silently drops references.
auto get_item(std::vector<int>& v, int i) {
    return v[i];              // returns int, not int& — assignment doesn't write to vector!
}
auto& get_item_ref(std::vector<int>& v, int i) {
    return v[i];              // int&, correct
}
decltype(auto) get_item_dt(std::vector<int>& v, int i) {
    return v[i];              // also int& (because v[i] is an lvalue)
}

// PITFALL: decltype((x)) inside a function.
int g() {
    int x = 5;
    // decltype(auto) ret = (x);    // returns int& — DANGLES! x dies at return.
    return x;
}`,
    seedQuestions: [
      "Why does `auto a = by_ref()` give `int` instead of `int&`?",
      "What's the practical difference between `decltype(x)` and `decltype((x))`?",
      "When should you reach for `decltype(auto)` instead of `auto`?",
      "Why is `auto get_item(...) { return v[i]; }` a subtle bug?",
    ],
  },
  {
    id: "cpp-adv-ctad",
    title: "Class Template Argument Deduction (CTAD)",
    difficulty: "Advanced",
    icon: "🧭",
    description:
      "Since C++17, you can write `std::pair p(1, 'a')` instead of `std::pair<int, char> p(1, 'a')`. The compiler deduces template arguments from constructors. Custom types get the same magic via DEDUCTION GUIDES. Used well, CTAD removes redundancy; used poorly, it deduces something surprising.",
    concepts: [
      "Implicit deduction guides from constructors",
      "User-defined deduction guides",
      "Aggregate deduction guides (C++20)",
      "When CTAD picks something surprising",
      "Library design with CTAD in mind",
    ],
    bridges: {
      Rust: "Rust's `let p = Pair(1, 'a')` infers naturally. CTAD brings C++ closer to that ergonomics.",
      Java: "Diamond operator `new ArrayList<>()` is a simpler form.",
      C#: "var + target-typed new — similar ergonomics.",
    },
    code: `#include <vector>
#include <utility>
#include <memory>

// PRE-CTAD: redundant.
// std::pair<int, double> p{1, 3.14};
// std::vector<int>       v{1, 2, 3};

// C++17 CTAD: deduce from constructor.
std::pair   p{1, 3.14};            // std::pair<int, double>
std::vector v{1, 2, 3};            // std::vector<int>
std::tuple  t{1, 'a', 3.0};        // std::tuple<int, char, double>

// USER-DEFINED type with deduction guide.
template <typename T>
class Box {
    T value_;
public:
    Box(T v) : value_(std::move(v)) {}
    T& get() { return value_; }
};

// Without a guide, CTAD already works for simple cases.
// For trickier ones, write an explicit guide:
template <typename T>
Box(T) -> Box<T>;                  // identical to implicit; explicit for clarity

Box b{42};                         // Box<int>
Box s{std::string("hi")};          // Box<std::string>

// GUIDE FOR NON-OBVIOUS DEDUCTION.
// Imagine a container that takes a pair of iterators:
template <typename T>
class Range {
    T* first_;
    T* last_;
public:
    template <typename It>
    Range(It first, It last) : first_(&*first), last_(&*last) {}
};

// CTAD on the constructor would deduce ranges by \`It\`, but we want T.
template <typename It>
Range(It, It) -> Range<typename std::iterator_traits<It>::value_type>;

// Now: Range r(v.begin(), v.end()); deduces Range<int>.

// AGGREGATE deduction (C++20):
template <typename T> struct Pt { T x; T y; };
Pt p2{1, 2};                       // Pt<int> — works without a guide

// CTAD PITFALL: COPYING vs WRAPPING.
std::vector v1{1, 2, 3};           // vector<int>
std::vector v2{v1};                // vector<int>, NOT vector<vector<int>>
                                   // Because std::vector has a copy ctor (vector(const vector&))
                                   // and CTAD picks it.

// Sometimes you want explicit:
std::vector<std::vector<int>> nested{v1};  // unambiguous

// LIBRARY DESIGN: write deduction guides for the common "what would the user expect?" case.
// std::function does this:
//   std::function f = [](int x) { return x + 1; };   // deduced as function<int(int)>\`,
    seedQuestions: [
      "Why does \`std::vector v2{v1}\` produce vector<int> and not vector<vector<int>>?",
      "When do you need to write a deduction guide, and when does the implicit one suffice?",
      "How does the Range example's guide change what's deduced from \`Range(begin, end)\`?",
      "What's an example where CTAD deduces something correct but surprising?",
    ],
  },
  {
    id: "cpp-adv-structured",
    title: "Structured Bindings & Decomposition",
    difficulty: "Advanced",
    icon: "🧷",
    description:
      "Structured bindings (C++17) let you decompose tuples, arrays, and aggregates into named locals in one statement. There are three deduction modes: by-tuple-protocol, by-array, by-aggregate. Customizing for your own types means specializing \`std::tuple_size\` and \`std::tuple_element\` and providing a \`get<>\` overload.",
    concepts: [
      "Three decomposition modes: array / tuple / aggregate",
      "auto& vs auto&& vs const auto& in bindings",
      "Customizing for user types (tuple_size + tuple_element + get)",
      "Range-for + bindings = iterate maps cleanly",
      "Pitfalls with proxy references (vector<bool>)",
    ],
    bridges: {
      Rust: "Rust's pattern matching covers this and more (full destructuring of enums).",
      JavaScript: "Destructuring assignment is the closest cousin.",
      Python: "Tuple unpacking \`(a, b) = pair\` is conceptually the same.",
    },
    code: \`#include <tuple>
#include <map>
#include <string>
#include <utility>

void demo() {
    // Tuple form.
    std::tuple t{1, "hello", 3.14};
    auto [i, s, d] = t;                  // copies
    auto& [ri, rs, rd] = t;              // references into t
    const auto& [ci, cs, cd] = t;        // const references

    // Array form.
    int arr[3] = {10, 20, 30};
    auto [a, b, c] = arr;                // a=10, b=20, c=30

    // Aggregate form — every public non-static member, in order.
    struct Point { int x, y; };
    Point p{1, 2};
    auto& [px, py] = p;

    // Range-for + bindings — clean map iteration.
    std::map<std::string, int> ages{{"Anna", 30}, {"Soraia", 28}};
    for (const auto& [name, age] : ages) {
        // name and age are const refs into the map's entries
    }
}

// CUSTOMIZE for your own type.
// 1. Specialize std::tuple_size.
// 2. Specialize std::tuple_element for each index.
// 3. Provide a get<I>() function (free or member).

namespace mine {
    struct Vec3 { double x, y, z; };

    template <std::size_t I>
    auto& get(Vec3& v) {
        if constexpr (I == 0) return v.x;
        if constexpr (I == 1) return v.y;
        if constexpr (I == 2) return v.z;
    }
}

namespace std {
    template <> struct tuple_size<mine::Vec3> : integral_constant<size_t, 3> {};
    template <size_t I> struct tuple_element<I, mine::Vec3> { using type = double; };
}

void custom_use() {
    mine::Vec3 v{1, 2, 3};
    auto& [x, y, z] = v;                 // works via the tuple protocol
}

// PITFALL: PROXY references in std::vector<bool>.
std::vector<bool> bits{true, false};
// auto [b0, b1] = bits;                 // ERROR — vector<bool> is special
// auto& [b0, b1] = bits;                // ERROR — proxy reference issues
// Use:
//   bits[0] = true;                     // works through proxy
// Or avoid vector<bool> entirely (deque<bool> or vector<char>).

// PITFALL: capturing structured bindings in lambdas.
// In C++17 you can't [name]-capture a structured binding; C++20 fixed this.
auto [k, v_] = std::make_pair(1, 2);
// C++17: [=] captures everything; [k] or [v_] is implementation-defined / often broken.
// C++20: works.\`,
    seedQuestions: [
      "What are the three decomposition modes, and how does the compiler decide which applies?",
      "Why does \`auto [a, b] = arr\` copy but \`auto& [a, b] = arr\` reference?",
      "What three things must you specialize/provide to make a custom type decomposable?",
      "Why is \`auto [b0, b1] = vector<bool>{...}\` problematic?",
    ],
  },
] };
