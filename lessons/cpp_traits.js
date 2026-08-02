export const cppTraits = { name: "Type Traits & Metaprogramming", lessons: [
  {
    id: "cpp-adv-integral-constant",
    title: "integral_constant & the Trait Pattern",
    difficulty: "Advanced",
    icon: "🧬",
    description:
      "Most of `<type_traits>` boils down to one base: `std::integral_constant<T, v>` — a type encoding a value. true_type and false_type are aliases. From this single primitive you can compose every yes/no question about a type. Understanding this is understanding metafunctions.",
    concepts: [
      "integral_constant<T, v> as a type-level value",
      "true_type and false_type",
      "::value vs ::type metafunctions",
      "_v and _t convenience aliases",
      "Compile-time dispatch on traits",
    ],
    bridges: {
      Haskell: "Type-level booleans (Prelude's `True` and `False` lifted to kinds) match exactly.",
      Rust: "Rust traits without methods (marker traits) play the same yes/no role.",
      Python: "isinstance() runs at runtime. Type traits run at compile time.",
    },
    code: `#include <type_traits>

// THE PRIMITIVE.
template <typename T, T v>
struct integral_constant {
    static constexpr T value = v;
    using value_type = T;
    using type       = integral_constant;
    constexpr operator value_type() const noexcept { return value; }
    constexpr value_type operator()() const noexcept { return value; }
};

using true_type  = integral_constant<bool, true>;
using false_type = integral_constant<bool, false>;

// PATTERN 1: a metafunction that returns a TYPE.
template <typename T> struct remove_const          { using type = T; };
template <typename T> struct remove_const<const T> { using type = T; };

// Convenience alias — no need to write ::type at call site.
template <typename T> using remove_const_t = typename remove_const<T>::type;

// PATTERN 2: a metafunction that returns a VALUE.
template <typename T> struct is_void              : false_type {};
template <>           struct is_void<void>        : true_type  {};
template <>           struct is_void<const void>  : true_type  {};

// Convenience variable template.
template <typename T> constexpr bool is_void_v = is_void<T>::value;

static_assert(is_void_v<void>);
static_assert(!is_void_v<int>);

// PATTERN 3: COMPOSITE — relate types to each other.
template <typename T, typename U> struct is_same      : false_type {};
template <typename T>             struct is_same<T,T> : true_type  {};

// DISPATCH via tag types: function overload picks based on which trait is true_type.
template <typename Iter>
void advance_impl(Iter& it, int n, std::random_access_iterator_tag) { it += n; }
template <typename Iter>
void advance_impl(Iter& it, int n, std::input_iterator_tag) { while (n--) ++it; }

template <typename Iter>
void advance(Iter& it, int n) {
    advance_impl(it, n, typename std::iterator_traits<Iter>::iterator_category{});
}

// DISPATCH via if constexpr (C++17) — often cleaner than tag dispatch.
template <typename T>
void process(T x) {
    if constexpr (std::is_integral_v<T>) {
        // integer branch — only compiled for integral T
    } else if constexpr (std::is_floating_point_v<T>) {
        // float branch
    } else {
        static_assert(sizeof(T) == 0, "unsupported type");
    }
}`,
    seedQuestions: [
      "Why does `integral_constant` have both `static constexpr value` and a conversion operator?",
      "What's the difference between `::value` and `::type` metafunctions, and why do both exist?",
      "Why is `if constexpr` often preferable to tag dispatch in modern code?",
      "Why does the `static_assert(sizeof(T) == 0, ...)` only fire in the else branch — not at template definition?",
    ],
  },
  {
    id: "cpp-adv-decay-common",
    title: "decay, common_type & Reference Manipulation",
    difficulty: "Advanced",
    icon: "🔧",
    description:
      "Trait combinators reshape types: strip references, add const, find a 'common' type that several types can convert to. `std::decay_t` mirrors what happens to function parameters passed by value. `std::common_type` is what `?:` chooses between two types. These are the workhorses of generic function signatures.",
    concepts: [
      "std::decay_t and pass-by-value semantics",
      "remove_reference, remove_cv, remove_cvref",
      "std::common_type and the ternary conversion rules",
      "std::conditional",
      "Reference/cv add and remove dance",
    ],
    bridges: {
      Rust: "Rust's `Deref` trait and `AsRef<T>` cover similar ground in a different direction.",
      Java: "Boxing/unboxing rules play a vaguely similar role — convert primitives to their boxed forms.",
      Python: "Dynamic typing means no compile-time conversion search.",
    },
    code: `#include <type_traits>
#include <string>
#include <vector>

// DECAY — what happens to a value when you pass by value.
// Rules:
//   - Drop references and cv-qualifiers.
//   - Arrays decay to pointers.
//   - Function types decay to function pointers.

static_assert(std::is_same_v<std::decay_t<int>,         int>);
static_assert(std::is_same_v<std::decay_t<const int&>,  int>);
static_assert(std::is_same_v<std::decay_t<int[5]>,      int*>);
static_assert(std::is_same_v<std::decay_t<int(int)>,    int(*)(int)>);

// REMOVE_CVREF (C++20) — common case without array/function decay.
static_assert(std::is_same_v<std::remove_cvref_t<const int&>, int>);
// But:
static_assert(std::is_same_v<std::remove_cvref_t<int[5]>, int[5]>);  // array kept!

// USE: storing a forwarded argument in a tuple.
template <typename... Args>
auto store(Args&&... args) {
    return std::tuple<std::decay_t<Args>...>(std::forward<Args>(args)...);
    //                ^^^^^^^^^^^^^^^^^^^^^
    // Without decay: tuple<int&, const std::string&> — dangerous on a returned tuple.
    // With decay:    tuple<int,  std::string>        — values, safe to return.
}

// COMMON_TYPE — what does the ternary \`cond ? a : b\` produce?
static_assert(std::is_same_v<std::common_type_t<int, double>,           double>);
static_assert(std::is_same_v<std::common_type_t<int, int&, const int&>, int>);
static_assert(std::is_same_v<std::common_type_t<short, int>,            int>);

// USE: a generic max() that handles mixed types.
template <typename A, typename B>
auto max_of(A a, B b) -> std::common_type_t<A, B> {
    return a < b ? b : a;
}

// CONDITIONAL — compile-time \`?:\` for types.
template <typename T>
using SignedOrConst = std::conditional_t<std::is_signed_v<T>,
                                          T,
                                          const T>;

// REFERENCE-MANIPULATING traits — useful in templates.
template <typename T>
auto& promote_to_ref(T&& x) {
    using NoRef = std::remove_reference_t<T>;
    using Ref   = std::add_lvalue_reference_t<NoRef>;
    return reinterpret_cast<Ref>(x);          // illustrative — usually unneeded in practice
}

// PRACTICAL chain: take a forwarding argument, get the underlying type.
template <typename T>
void inspect(T&& x) {
    using Underlying = std::remove_cvref_t<T>;
    if constexpr (std::is_same_v<Underlying, std::string>) { /* string branch */ }
    else if constexpr (std::is_arithmetic_v<Underlying>)   { /* number branch */ }
}`,
    seedQuestions: [
      "Why does `std::decay_t` exist — what does it model that `remove_cvref_t` doesn't?",
      "What does std::common_type<int, std::string> produce, and why?",
      "Why is storing forwarded args in a tuple wrong without decay?",
      "How would `common_type_t<int*, int[5]>` resolve, given array decay?",
    ],
  },
  {
    id: "cpp-adv-detection-idiom",
    title: "void_t & The Detection Idiom",
    difficulty: "Staff",
    icon: "🔎",
    description:
      "Before concepts, the detection idiom let you ask 'does type T have a member named foo with this signature?' at compile time. It builds on SFINAE + `std::void_t`. Even after C++20 concepts, you'll meet this idiom in older library code — and the underlying mechanism teaches you how SFINAE actually works.",
    concepts: [
      "SFINAE: substitution failure is not an error",
      "std::void_t as a SFINAE switch",
      "The std::experimental::is_detected pattern",
      "Detecting members, free functions, operators",
      "When to migrate to concepts",
    ],
    bridges: {
      Rust: "Rust would use `where T: SomeTrait` — much cleaner. The detection idiom is the C++17 path to the same thing.",
      Haskell: "Type families with closed cases give similar power.",
      Python: "hasattr() does this at runtime. C++ does it at compile time.",
    },
    code: `#include <type_traits>
#include <utility>

// std::void_t — maps any pack of types to void. Used to swallow SFINAE checks.
// Definition (logical): template <typename...> using void_t = void;

// THE DETECTION IDIOM.
// Primary template: claim "T does NOT have member ::value_type".
template <typename T, typename = void>
struct has_value_type : std::false_type {};

// Specialization: only valid if T::value_type is a well-formed name.
// If substitution fails, this specialization drops out (SFINAE).
template <typename T>
struct has_value_type<T, std::void_t<typename T::value_type>> : std::true_type {};

struct Has    { using value_type = int; };
struct Hasnt  {};
static_assert( has_value_type<Has>::value);
static_assert(!has_value_type<Hasnt>::value);

// DETECT a MEMBER FUNCTION with a specific signature.
template <typename T, typename = void>
struct has_size : std::false_type {};
template <typename T>
struct has_size<T, std::void_t<decltype(std::declval<T>().size())>> : std::true_type {};

// std::declval<T>() yields a (fake) reference to T for use in unevaluated contexts.

// GENERIC is_detected — the "detector toolkit" (C++17 TS).
template <typename Default, typename AlwaysVoid, template <typename...> class Op, typename... Args>
struct detector { using value_t = std::false_type; using type = Default; };

template <typename Default, template <typename...> class Op, typename... Args>
struct detector<Default, std::void_t<Op<Args...>>, Op, Args...> {
    using value_t = std::true_type; using type = Op<Args...>;
};

template <template <typename...> class Op, typename... Args>
using is_detected = typename detector<void, void, Op, Args...>::value_t;

// Use it: define a "query" alias for the expression you want to test.
template <typename T> using has_to_string_t = decltype(std::declval<T>().to_string());

static_assert(is_detected<has_to_string_t, std::string>::value);  // true
// static_assert(is_detected<has_to_string_t, int>::value);       // false

// MIGRATION to C++20 concepts — much shorter.
template <typename T>
concept HasToString = requires(T t) { t.to_string(); };
static_assert(HasToString<std::string>);

// WHEN you still need the detection idiom:
//   - You target C++17.
//   - You're working inside a header that already uses it heavily.
//   - You need to expose an enum/boolean publicly named like a trait.
// Otherwise, USE CONCEPTS.\`,
    seedQuestions: [
      "What does \`std::void_t\` actually do — why is it useful as a 'SFINAE switch'?",
      "Why does the specialization 'drop out' instead of producing an error?",
      "What's \`std::declval\` for — couldn't you just use a default-constructed T?",
      "What's a case where you still might need the detection idiom in a modern C++20 codebase?",
    ],
  },
  {
    id: "cpp-adv-tag-dispatch",
    title: "Tag Dispatch & Policy Selection",
    difficulty: "Staff",
    icon: "🏷️",
    description:
      "Tag dispatch picks an implementation by passing a tag type that selects an overload. Used in <iterator> for category-specific algorithms, in allocators for propagation traits, and in custom code for compile-time strategy selection. Cleaner than enable_if, often more readable than if constexpr.",
    concepts: [
      "Tag types as compile-time selectors",
      "Hierarchical tags & overload preference",
      "Tag dispatch vs if constexpr vs concepts",
      "Customization point objects (CPOs)",
      "Niebloids and the std::ranges design",
    ],
    bridges: {
      Rust: "Trait dispatch with associated types does this implicitly.",
      Haskell: "Type class instance selection.",
      Java: "Strategy pattern at runtime; tag dispatch is its compile-time cousin.",
    },
    code: \`#include <iterator>
#include <type_traits>

// TAG hierarchy from <iterator>:
//   input_iterator_tag
//   ↓ inherits
//   forward_iterator_tag
//   ↓ inherits
//   bidirectional_iterator_tag
//   ↓ inherits
//   random_access_iterator_tag
//   ↓ inherits
//   contiguous_iterator_tag

// Dispatch by category.
template <typename Iter>
auto distance_impl(Iter a, Iter b, std::input_iterator_tag) {
    typename std::iterator_traits<Iter>::difference_type n = 0;
    while (a != b) { ++a; ++n; }
    return n;
}
template <typename Iter>
auto distance_impl(Iter a, Iter b, std::random_access_iterator_tag) {
    return b - a;                            // O(1)
}

template <typename Iter>
auto distance(Iter a, Iter b) {
    return distance_impl(a, b,
        typename std::iterator_traits<Iter>::iterator_category{});
}

// HIERARCHY MAGIC: when you call distance_impl with random_access_iterator_tag,
// it's also an input_iterator_tag (by inheritance), so BOTH overloads match.
// Overload resolution picks the more derived tag → the O(1) version.

// COMPARE: if constexpr version (often nicer).
template <typename Iter>
auto distance_v2(Iter a, Iter b) {
    using Cat = typename std::iterator_traits<Iter>::iterator_category;
    if constexpr (std::is_base_of_v<std::random_access_iterator_tag, Cat>) {
        return b - a;
    } else {
        typename std::iterator_traits<Iter>::difference_type n = 0;
        while (a != b) { ++a; ++n; }
        return n;
    }
}

// CONCEPTS version (cleanest).
template <std::random_access_iterator Iter>
auto distance_v3(Iter a, Iter b) { return b - a; }
template <std::input_iterator Iter>
auto distance_v3(Iter a, Iter b) {
    typename std::iter_difference_t<Iter> n = 0;
    while (a != b) { ++a; ++n; }
    return n;
}

// CUSTOMIZATION POINT OBJECTS (CPOs) — modern dispatch.
// std::ranges::begin(x) is a CPO. It tries:
//   - x.begin() if x has it
//   - begin(x)  via ADL otherwise
//   - rejects rvalue containers
// All controlled by a struct with operator() and a poison overload set.

// "niebloid" = a CPO defined as an inline constexpr object of an unnameable type.
// Why? To prevent ADL hijacking: users can't add overloads found by ADL when calling.
// std::ranges algorithms are all niebloids.\`,
    seedQuestions: [
      "Why does the iterator tag hierarchy use inheritance — what does it enable for overload resolution?",
      "When would you prefer tag dispatch over \`if constexpr\` despite the latter being newer?",
      "What is a customization point object and what problem does it solve that ordinary free functions don't?",
      "Why are niebloids designed to be 'unnameable' and resistant to ADL?",
    ],
  },
] };
