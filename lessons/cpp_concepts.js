export const cppConcepts = { name: "Concepts & Constraints", lessons: [
  {
    id: "cpp-adv-requires",
    title: "requires Clauses & Concepts",
    difficulty: "Core",
    icon: "📜",
    description:
      "Concepts (C++20) finally let you say what a template parameter must support, and get a one-line error when it doesn't. The `requires` clause attaches a boolean predicate to a template. A `concept` is a named, reusable predicate. Together they replace 95% of SFINAE.",
    concepts: [
      "requires clause syntax",
      "Defining a concept",
      "requires expression vs requires clause",
      "Concept-constrained auto",
      "Shorthand syntax",
    ],
    bridges: {
      Rust: "Rust traits are concepts. `where T: Trait` is `requires Trait<T>`. Rust always had this; C++ got it 13 years later.",
      Haskell: "Type class constraints are the same idea.",
      Java: "Bounded type parameters `<T extends X>` are a degenerate form of concepts.",
    },
    code: `#include <concepts>
#include <iterator>
#include <type_traits>

// 1. DEFINE a concept.
template <typename T>
concept Numeric = std::integral<T> || std::floating_point<T>;

// 2. USE a concept as a type constraint.
template <Numeric T>
T square(T x) { return x * x; }

// 3. SHORTHAND function-argument syntax (auto + concept).
auto cube(Numeric auto x) { return x * x * x; }

// 4. REQUIRES CLAUSE — attach an arbitrary boolean.
template <typename T>
    requires std::copyable<T> && std::default_initializable<T>
T make_copy(const T& x) { return T(x); }

// 5. REQUIRES EXPRESSION — define a concept by what operations work.
template <typename T>
concept HasSize = requires(T t) {
    { t.size() } -> std::convertible_to<std::size_t>;
    //    ^ expression must compile, with return-type constraint
};

// REQUIRES EXPRESSION clauses:
template <typename T>
concept ReadableStream = requires(T s, char* buf, std::size_t n) {
    s.read(buf, n);                                     // expression valid
    { s.eof() } -> std::same_as<bool>;                  // return-type
    typename T::char_type;                              // nested type exists
    requires std::default_initializable<T>;             // a nested concept check
};

// 6. CONCEPTS IN OVERLOAD SETS — better than SFINAE.
template <typename T>
void print(T x) requires std::integral<T> { /* int format */ }

template <typename T>
void print(T x) requires std::floating_point<T> { /* float format */ }

// 7. NEGATING / COMBINING concepts.
template <typename T>
concept NonPtr = !std::is_pointer_v<T>;

template <typename T>
concept Hashable = requires(T x) { { std::hash<T>{}(x) } -> std::convertible_to<std::size_t>; };

// 8. CONSTRAINING a class template.
template <std::integral T>
class Counter {
    T n_ = 0;
public:
    void tick() { ++n_; }
    T count() const { return n_; }
};

// Counter<double> c;     // ERROR with a clean message:
//   "the constraint 'std::integral<double>' was not satisfied"

// Compare to pre-C++20 SFINAE — which we'll see next lesson.\`,
    seedQuestions: [
      "What's the difference between a \`requires\` clause and a \`requires\` expression?",
      "How does \`{ expr } -> Concept\` work — what is it actually checking?",
      "Why does the error message become so much shorter compared to SFINAE failures?",
      "What does the \`requires requires\` syntax mean if you ever see it?",
    ],
  },
  {
    id: "cpp-adv-subsumption",
    title: "Concept Composition & Subsumption",
    difficulty: "Advanced",
    icon: "🪜",
    description:
      "When two overloads both satisfy a call, concepts pick the MORE CONSTRAINED one. The compiler analyzes the concepts as logical formulas (atomic constraints joined by && and ||) and checks whether one SUBSUMES the other. This is what makes concept-based overload sets compose cleanly — but the subsumption rules have sharp edges.",
    concepts: [
      "Subsumption between concept formulas",
      "Atomic constraints",
      "Why \`requires (sizeof(T) > 0)\` doesn't subsume itself",
      "Concept hierarchies in the standard library",
      "Disambiguating overloads with concepts",
    ],
    bridges: {
      Rust: "Rust uses trait objects and impl specialization (unstable) for similar resolution. Subsumption is implicit in the trait hierarchy.",
      Haskell: "Type class hierarchies (Eq → Ord) play the same role.",
      Java: "No comparable mechanism in generics.",
    },
    code: \`#include <concepts>
#include <iterator>

// SUBSUMPTION example. Two overloads, both match — concept-aware ranking picks the better one.
template <std::input_iterator I>
void advance_by(I& i, int n) { /* generic */ }

template <std::random_access_iterator I>
void advance_by(I& i, int n) { i += n; }      // more constrained → preferred

// std::random_access_iterator IS-A std::input_iterator (via the hierarchy).
// When both overloads match, the random_access one subsumes the input one.

// ATOMIC CONSTRAINTS — the unit of subsumption.
// Two constraints are "the same atomic constraint" iff they appear in the SAME source-code
// location (literally). Two TEXTUALLY identical predicates from different lines are NOT.

template <typename T>
concept HasSize1 = requires(T t) { t.size(); };

template <typename T>
concept HasSize2 = requires(T t) { t.size(); };
// HasSize1 and HasSize2 are NOT subsumption-equivalent — different atomic constraints!

// WHY: subsumption is checked syntactically on the constraint expressions, not by
// evaluating them. The same expression literally written twice is two distinct atoms.

// GOTCHA: prefer composing from named concepts.
template <typename T> concept Movable      = std::move_constructible<T>;
template <typename T> concept Copyable     = Movable<T> && std::copy_constructible<T>;
template <typename T> concept Regular      = Copyable<T> && std::default_initializable<T> &&
                                              std::equality_comparable<T>;

// Now subsumption works: Regular subsumes Copyable subsumes Movable.

// DISAMBIGUATING OVERLOADS — the canonical example.
template <std::input_iterator I, std::sentinel_for<I> S>
void process(I first, S last) { /* generic forward pass */ }

template <std::contiguous_iterator I, std::sized_sentinel_for<I> S>
void process(I first, S last) { /* memcpy / SIMD shortcut */ }

// Both match for vector<int>::iterator. Contiguous subsumes input → second is chosen.

// PITFALL: \`requires (sizeof(T) > 0)\` and another \`requires (sizeof(T) > 0)\`
// from a different declaration are DIFFERENT atomic constraints.
// They do not subsume each other. Resolution fails with ambiguity.

// FIX: extract the constraint into a named concept and reuse THAT.
template <typename T> concept SizeOk = sizeof(T) > 0;`,
    seedQuestions: [
      "Why are two textually identical `requires` clauses treated as different atomic constraints?",
      "Why is `std::random_access_iterator` preferred over `std::input_iterator` when both apply?",
      "What's the practical lesson for writing concepts: ad-hoc predicates vs named concepts?",
      "Give one example where subsumption could lead to a surprise — different overloads picked than you'd guess.",
    ],
  },
  {
    id: "cpp-adv-concept-design",
    title: "Designing a Concept Hierarchy",
    difficulty: "Staff",
    icon: "🏛️",
    description:
      "Good concepts are SEMANTIC, not just syntactic. The standard library's <ranges>, <iterator>, and arithmetic concepts demonstrate the pattern: define what operations exist AND what their semantic guarantees are (documented, not enforced). Bad concepts list random methods; good concepts cluster around real-world capabilities.",
    concepts: [
      "Syntactic vs semantic requirements",
      "Documented axioms",
      "Concept hierarchies that compose",
      "Avoiding 'over-constraint'",
      "Refinement chains (std::iterator hierarchy)",
    ],
    bridges: {
      Rust: "Rust traits follow the same pattern; std::iter::Iterator has DoubleEndedIterator, ExactSizeIterator refinements.",
      Haskell: "Functor → Applicative → Monad is the classic refinement chain.",
      Java: "Java's Collection hierarchy is informally similar but enforced only by inheritance, not generics.",
    },
    code: `#include <concepts>
#include <iterator>
#include <ranges>

// THE STD::ITERATOR HIERARCHY (simplified):
//
//   input_iterator         — readable, single-pass
//     forward_iterator     — multi-pass
//       bidirectional_iterator — also goes backwards
//         random_access_iterator — O(1) jumps
//           contiguous_iterator   — pointer-equivalent layout
//
// Each refines the previous. Algorithms pick the best fit at compile time.

// EXAMPLE — your own refinement chain.

template <typename T>
concept Readable = requires(T t) {
    { *t } -> std::same_as<typename T::value_type>;
};

template <typename T>
concept Forward = Readable<T> && requires(T t) {
    { ++t } -> std::same_as<T&>;
    requires std::copyable<T>;        // multi-pass requires copyability
};

template <typename T>
concept Random = Forward<T> && requires(T t, std::ptrdiff_t n) {
    { t + n } -> std::same_as<T>;
    { t - t } -> std::same_as<std::ptrdiff_t>;
};

// SEMANTIC REQUIREMENTS go in DOCUMENTATION, not the concept.
//
//   Forward<T>:  After incrementing one copy, OTHER copies still see the old value.
//   Random<T>:   t + n is O(1) and equivalent to incrementing n times.
//
// The compiler can't check these. The TYPE author guarantees them. The CALLER trusts them.
// Without these axioms, "satisfies the concept" is meaningless.

// AVOIDING OVER-CONSTRAINT — common mistake.
//
// Bad concept (over-constrained):
template <typename T>
concept Container = requires(T t) {
    t.begin(); t.end(); t.size(); t.empty(); t.clear();
    typename T::value_type;
    typename T::iterator;
    // ...everything I happen to want
};
// Problem: now your function rejects std::array (no .clear()), std::string_view (no .clear()),
// arrays, ...

// Better — minimal requirements for what THIS function actually needs.
template <typename T>
concept SizedRange = std::ranges::range<T> && std::ranges::sized_range<T>;

// REFINEMENT chains compose because constraints are NAMED and STABLE.
// Adding a new concept that combines two existing ones is one line.

template <typename T>
concept SortableRange = std::ranges::random_access_range<T> &&
                       std::sortable<std::ranges::iterator_t<T>>;`,
    seedQuestions: [
      "Why can't the compiler enforce semantic requirements — and what stops you from defining a concept that lies?",
      "How does the iterator hierarchy let an algorithm dispatch to a faster implementation automatically?",
      "What goes wrong when a concept lists every method the type 'usually has' instead of only what the algorithm needs?",
      "Why is `random_access_range` more useful than a hypothetical `Container` concept?",
    ],
  },
] };
