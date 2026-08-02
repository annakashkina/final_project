export const cppVariadic = { name: "Variadic Templates", lessons: [
  {
    id: "cpp-adv-packs",
    title: "Parameter Packs",
    difficulty: "Advanced",
    icon: "📚",
    description:
      "A template parameter pack holds zero or more types or values. Pack expansion (`pack...`) is the only way to 'use' a pack — it generates a comma-separated list of expressions in whatever context it appears. The pattern is: write what you want done to ONE element, then expand.",
    concepts: [
      "Type packs vs value packs",
      "Pack expansion contexts",
      "sizeof...(pack) for arity",
      "Patterns: function args, base classes, initializer lists",
      "Recursion vs fold expressions",
    ],
    bridges: {
      Rust: "Rust has variadic generics in unstable form via tuples and macro_rules. C++ variadics are first-class.",
      Java: "Java varargs are runtime (T... args creates a T[]). C++ packs are compile-time, fully typed per argument.",
      Python: "Python *args is dynamic. C++ packs are typed per-position.",
    },
    code: `#include <iostream>
#include <utility>
#include <tuple>
#include <type_traits>

// 1. RECURSIVE variadic — the C++11 way.
template <typename T>
void print_recursive(const T& x) { std::cout << x << '\\n'; }

template <typename T, typename... Rest>
void print_recursive(const T& x, const Rest&... rest) {
    std::cout << x << ' ';
    print_recursive(rest...);          // pack expansion
}

// 2. FOLD EXPRESSION (C++17) — the modern way.
template <typename... Args>
void print_fold(const Args&... args) {
    ((std::cout << args << ' '), ...);  // comma fold: left-fold of \`,\`
    std::cout << '\\n';
}

// PACK EXPANSION can appear in many contexts:
template <typename... Args>
auto sum(Args... args) {
    return (args + ...);                // unary right fold: a1 + (a2 + (a3 + ...))
}

template <typename... Args>
auto sum0(Args... args) {
    return (0 + ... + args);            // binary left fold: ((0 + a1) + a2) + a3
                                        // (handles zero-argument case: 0)
}

template <typename... Args>
auto all(Args... args) {
    return (... && args);               // binary left fold: true && a1 && a2 ...
}

// PACK in INITIALIZER LIST — handy when no fold fits.
template <typename... Args>
auto to_array(Args... args) {
    return std::array{static_cast<std::common_type_t<Args...>>(args)...};
}

// PACK in BASE CLASS list — variadic mixin.
template <typename... Bases>
struct Inherit : Bases... {
    using Bases::operator()...;         // pull all bases' operator() into one overload set
};

struct CallableA { void operator()(int) {} };
struct CallableB { void operator()(double) {} };

void mixin_demo() {
    Inherit<CallableA, CallableB> both;
    both(1);            // calls A
    both(3.14);         // calls B
}

// PACK in TEMPLATE ARG LIST.
template <typename... Ts>
using tuple_of_ptrs = std::tuple<Ts*...>;

using P = tuple_of_ptrs<int, double, char>;   // std::tuple<int*, double*, char*>

// sizeof... — arity of the pack (not size in bytes).
template <typename... Args>
constexpr std::size_t arity_of(Args...) { return sizeof...(Args); }

static_assert(arity_of(1, 2, 3, 4) == 4);`,
    seedQuestions: [
      "What's the difference between `(args + ...)` and `(... + args)`?",
      "Why does `(0 + ... + args)` work for an empty pack but `(args + ...)` doesn't?",
      "What does `using Bases::operator()...;` do in a variadic mixin?",
      "When would you still write a recursive variadic instead of a fold expression?",
    ],
  },
  {
    id: "cpp-adv-folds",
    title: "Fold Expressions",
    difficulty: "Advanced",
    icon: "🪗",
    description:
      "Fold expressions (C++17) compress pack expansions over binary operators into one terse syntax. Four forms: unary left/right, binary left/right. They handle short-circuiting (`&&`, `||`) and the comma operator gracefully — and they finally make variadic templates ergonomic.",
    concepts: [
      "Unary vs binary folds",
      "Left vs right associativity",
      "Empty-pack rules (only some ops have identities)",
      "Short-circuit folds with && and ||",
      "Comma folds for side effects",
    ],
    bridges: {
      Haskell: "Folds (foldl/foldr) are the parent concept. C++ adopted the name and the left/right distinction.",
      Rust: "Rust iterators' .fold() is runtime; C++ folds are compile-time over a pack.",
      Python: "functools.reduce parallels at runtime, no compile-time analog.",
    },
    code: `#include <iostream>
#include <type_traits>
#include <vector>

// FOUR FORMS of fold expression.
template <typename... Args>
auto fold_demo(Args... args) {
    auto a = (args + ...);                 // unary right:  a1 + (a2 + (a3 + ...))
    auto b = (... + args);                 // unary left:   ((a1 + a2) + a3) + ...
    auto c = (0 + ... + args);             // binary left:  ((0 + a1) + a2) + ...
    auto d = (args + ... + 0);             // binary right: a1 + (a2 + (a3 + 0))
    return std::tuple{a, b, c, d};
}

// SHORT-CIRCUIT folds.
template <typename... Args>
bool all_true(Args... args) {
    return (... && args);                  // stops at first false
}
template <typename... Args>
bool any_true(Args... args) {
    return (... || args);                  // stops at first true
}

// COMMA fold — for-each over a pack with side effects.
template <typename... Args>
void log_each(const Args&... args) {
    ((std::cout << args << '\\n'), ...);    // comma fold
}

// REAL PATTERN: push all into a vector.
template <typename T, typename... Args>
void push_all(std::vector<T>& v, Args&&... args) {
    (v.push_back(std::forward<Args>(args)), ...);
}

// EMPTY-PACK rules:
//   Unary folds REQUIRE non-empty pack EXCEPT for &&, ||, and , which have defaults:
//     &&   → true
//     ||   → false
//     ,    → void()
//   Binary folds work for empty pack — yields the init.
//
// So (args + ...) with zero args is a COMPILE ERROR.
// But (0 + ... + args) with zero args is just 0.

template <typename... Args>
auto safe_sum(Args... args) {
    return (0 + ... + args);               // 0 for empty pack — robust
}

// FOLD WITH FUNCTION CALLS — invoke a callable on each.
template <typename F, typename... Args>
void for_each_arg(F&& f, Args&&... args) {
    (f(std::forward<Args>(args)), ...);
}

// SUBTLE: order of evaluation matters for side effects.
//   Comma fold: left-to-right guaranteed.
//   Operator folds: associativity controls grouping, not evaluation order
//                   (but operands of + and friends are unsequenced!).
// If side effects matter, use a COMMA fold.\`,
    seedQuestions: [
      "What's the difference in expansion between \`(args + ...)\` and \`(... + args)\`?",
      "Which operators allow an empty pack in a unary fold, and what do they evaluate to?",
      "Why is a comma fold the right tool for invoking f(x) on each pack element?",
      "What's the practical difference between left and right folds for a non-associative operator like subtraction?",
    ],
  },
  {
    id: "cpp-adv-indexing-tricks",
    title: "Pack Indexing & Type List Operations",
    difficulty: "Staff",
    icon: "🔢",
    description:
      "Real metaprogramming wants to manipulate type lists: get the N-th type, filter, append, transform. C++ doesn't give you these primitives — you build them with std::index_sequence, partial specialization, and \`if constexpr\`. This is the toolkit behind std::tuple, std::variant, and every serious metaprogramming library.",
    concepts: [
      "std::index_sequence and make_index_sequence",
      "Indexing into a parameter pack",
      "Type list as a class template",
      "Map/filter/append on type lists",
      "Compile-time integer sequences",
    ],
    bridges: {
      Haskell: "Type-level lists are first-class; here you're encoding them in template parameter packs.",
      Rust: "Rust uses tuple recursion + traits (frunk crate) for similar work.",
      Python: "typing.Tuple etc. are runtime; no equivalent at compile time.",
    },
    code: \`#include <utility>
#include <tuple>
#include <type_traits>

// std::index_sequence<I...> is just a type holding compile-time integers.
// make_index_sequence<N> builds <0, 1, ..., N-1>.

// Indexing into a pack by position using fold-and-discard.
template <std::size_t I, typename... Ts>
struct nth { using type = std::tuple_element_t<I, std::tuple<Ts...>>; };

template <std::size_t I, typename... Ts>
using nth_t = typename nth<I, Ts...>::type;

static_assert(std::is_same_v<nth_t<2, int, double, char, bool>, char>);

// VALUE indexing: use index_sequence to unpack.
template <typename Tuple, std::size_t... I>
void print_tuple_impl(const Tuple& t, std::index_sequence<I...>) {
    ((std::cout << std::get<I>(t) << ' '), ...);
}
template <typename... Ts>
void print_tuple(const std::tuple<Ts...>& t) {
    print_tuple_impl(t, std::index_sequence_for<Ts...>{});
}

// TYPE LIST as a class template.
template <typename... Ts> struct type_list {};

// SIZE.
template <typename L> struct length;
template <typename... Ts> struct length<type_list<Ts...>> { static constexpr std::size_t value = sizeof...(Ts); };

// APPEND.
template <typename L, typename T> struct append;
template <typename... Ts, typename T> struct append<type_list<Ts...>, T> { using type = type_list<Ts..., T>; };

// MAP — apply a metafunction to every element.
template <template <typename> class F, typename L> struct map;
template <template <typename> class F, typename... Ts>
struct map<F, type_list<Ts...>> { using type = type_list<F<Ts>...>; };

// Example: turn every type into its pointer.
template <typename T> using add_ptr = T*;
using PtrList = map<add_ptr, type_list<int, double, char>>::type;
static_assert(std::is_same_v<PtrList, type_list<int*, double*, char*>>);

// FILTER — keep only those matching a predicate.
template <template <typename> class Pred, typename L> struct filter;
template <template <typename> class Pred, typename T, typename... Ts>
struct filter<Pred, type_list<T, Ts...>> {
    using rest = typename filter<Pred, type_list<Ts...>>::type;
    using type = std::conditional_t<Pred<T>::value,
                                    typename append<rest, T>::type,
                                    rest>;
};
template <template <typename> class Pred>
struct filter<Pred, type_list<>> { using type = type_list<>; };

using Integers = filter<std::is_integral, type_list<int, double, char, float, bool>>::type;
static_assert(std::is_same_v<Integers, type_list<int, char, bool>>);`,
    seedQuestions: [
      "Why does indexing into a pack require std::index_sequence — why isn't `pack[I]` enough?",
      "What does `std::index_sequence_for<Ts...>` produce, and why is it more ergonomic than make_index_sequence?",
      "Why does the filter implementation need both a recursive case and a base case?",
      "Could you implement the same type-list operations using only concepts and `requires`?",
    ],
  },
] };
