export const cppRanges = { name: "Ranges & Views", lessons: [
  {
    id: "cpp-adv-ranges-basics",
    title: "Ranges, Views, and Range Algorithms",
    difficulty: "Advanced",
    icon: "🔭",
    description:
      "C++20 ranges replace the iterator-pair `algorithm(first, last)` pattern with `algorithm(range)`. Beyond ergonomics, ranges add VIEWS: lazy, composable transformations over a range that don't allocate or copy. `vec | filter(...) | transform(...) | take(10)` is the new idiom — and it actually generates efficient code.",
    concepts: [
      "range vs container vs view",
      "Range concepts: input/forward/.../contiguous",
      "Lazy views vs eager containers",
      "Pipe syntax via |",
      "Range algorithms in std::ranges",
    ],
    bridges: {
      Rust: "Rust iterators (.filter().map().take()) are exactly this model — and what C++ ranges drew from.",
      Python: "itertools is the eager-by-default analog. Ranges are pull-based, same as Python's generators.",
      Java: "Java Streams are similar but always materialize at the end; ranges integrate with for-each.",
    },
    code: `#include <ranges>
#include <vector>
#include <iostream>
#include <string>

void demo() {
    std::vector<int> nums{1, 2, 3, 4, 5, 6, 7, 8, 9, 10};

    // RANGE ALGORITHM — first replacement for iterator pairs.
    std::ranges::sort(nums);                       // no .begin()/.end() needed
    auto it = std::ranges::find(nums, 7);
    auto cnt = std::ranges::count_if(nums, [](int x){ return x > 3; });

    // VIEWS — lazy transformations.
    auto even_squares = nums
        | std::views::filter([](int x){ return x % 2 == 0; })
        | std::views::transform([](int x){ return x * x; });

    for (int x : even_squares) std::cout << x << ' ';   // 4 16 36 64 100

    // No vector materialized. Each iteration:
    //   for-loop asks the chain for next value
    //   transform pulls from filter
    //   filter pulls from nums, skipping odd
    // ONE PASS, NO ALLOCATIONS.

    // TAKE / DROP — slice without copying.
    auto first_three = nums | std::views::take(3);    // {1,2,3}
    auto after_three = nums | std::views::drop(3);

    // REVERSE — bidirectional view.
    auto rev = nums | std::views::reverse;

    // STRIDING (C++23): every Nth element.
    auto stride2 = nums | std::views::stride(2);

    // JOIN — flatten a range of ranges.
    std::vector<std::vector<int>> nested{{1,2},{3,4},{5}};
    auto flat = nested | std::views::join;             // 1 2 3 4 5

    // ZIP (C++23): pair up two ranges.
    std::vector<std::string> names{"Anna","Soraia","Henry"};
    std::vector<int>         ages {30,    28,       45    };
    for (auto [n, a] : std::views::zip(names, ages))
        std::cout << n << '=' << a << ' ';
}

// MATERIALIZE a view into a container (C++23):
//   auto v = nums | std::views::filter(odd) | std::ranges::to<std::vector>();
// (Without C++23: copy with the range constructor of vector.)

// RANGE CONCEPTS — algorithms specify what they need.
// std::ranges::sort requires random_access_range + sortable.
// std::ranges::find  needs only input_range.
// Bad inputs fail at the call site with a clean concept message.

// COST MODEL:
//   - filter/transform/take/drop: zero allocation, optimal code generation typically.
//   - join: cheap, lazy.
//   - sort: needs a real container (cannot lazy-sort a view).
//   - reverse: requires bidirectional underlying range.\`,
    seedQuestions: [
      "What's the practical difference between a view and a container?",
      "Why does \`vec | filter | transform | take(10)\` need no intermediate allocations?",
      "Why can you sort a vector but not a view-of-filtered-vector?",
      "How does the range-concept system give you better error messages than iterator-based algorithms?",
    ],
  },
  {
    id: "cpp-adv-ranges-views",
    title: "Custom Views & Adaptors",
    difficulty: "Staff",
    icon: "🧬",
    description:
      "When the standard views aren't enough, you write your own. A custom view is a class that exposes \`begin()\`/\`end()\`, models \`std::ranges::view\`, and provides cheap construction/copy. Combined with a 'range adaptor' helper, your view plugs into the \`|\` pipeline seamlessly.",
    concepts: [
      "view_interface CRTP base",
      "Custom iterator + sentinel",
      "Range adaptor closure objects",
      "Plugging into the pipe syntax",
      "Why views must be cheap to copy",
    ],
    bridges: {
      Rust: "Implement \`Iterator\` for your wrapper struct — same pattern, slightly less ceremony.",
      Python: "Writing a generator function gives you most of this for free.",
      JavaScript: "Implement [Symbol.iterator]; same shape.",
    },
    code: \`#include <ranges>
#include <iterator>
#include <iostream>

// Custom view: pairs each element with its index.
template <std::ranges::view V>
class enumerate_view : public std::ranges::view_interface<enumerate_view<V>> {
    V base_;
public:
    enumerate_view() = default;
    enumerate_view(V v) : base_(std::move(v)) {}

    struct sentinel { std::ranges::sentinel_t<V> end_; };

    struct iterator {
        std::ranges::iterator_t<V> it;
        std::size_t                idx = 0;

        using value_type        = std::pair<std::size_t, std::ranges::range_value_t<V>>;
        using difference_type   = std::ptrdiff_t;
        using iterator_category = std::input_iterator_tag;

        value_type operator*() const { return {idx, *it}; }
        iterator& operator++() { ++it; ++idx; return *this; }
        iterator  operator++(int) { auto t = *this; ++*this; return t; }
        bool operator==(const sentinel& s) const { return it == s.end_; }
    };

    iterator begin() { return {std::ranges::begin(base_), 0}; }
    sentinel end()   { return {std::ranges::end(base_)}; }
};

// DEDUCTION GUIDE.
template <typename R> enumerate_view(R&&) -> enumerate_view<std::views::all_t<R>>;

// RANGE ADAPTOR CLOSURE — enables \`| enumerate\`.
struct enumerate_fn {
    template <std::ranges::viewable_range R>
    constexpr auto operator()(R&& r) const {
        return enumerate_view{std::views::all(std::forward<R>(r))};
    }

    template <std::ranges::viewable_range R>
    friend constexpr auto operator|(R&& r, const enumerate_fn& self) {
        return self(std::forward<R>(r));
    }
};
inline constexpr enumerate_fn enumerate;

void demo() {
    std::vector v{"a","b","c"};
    for (auto [i, s] : v | enumerate)
        std::cout << i << ':' << s << ' ';
    // 0:a 1:b 2:c
}

// REAL standard library has std::views::enumerate in C++23 — but writing your own
// teaches the full mechanism.

// IMPORTANT INVARIANTS for a view:
//   - O(1) copy. Views must be cheap; they often get copied during composition.
//   - Doesn't own the underlying data — that's the container's job.
//   - Models input_range at minimum; higher categories unlock more algorithms.

// COMMON PITFALL: temporary range as input.
//   auto v = get_vec() | enumerate;
//   for (auto&& x : v) ...                 // get_vec()'s vector is gone! dangle.
// Fix: bind the source first, or use std::views::owning_view (C++23).\`,
    seedQuestions: [
      "Why must views be cheap to copy — what would break if they were expensive?",
      "What does \`view_interface\` give you for free, and what must you still implement?",
      "How does the adaptor closure object enable the \`| enumerate\` syntax?",
      "What's the danger of \`auto v = get_vec() | enumerate;\`?",
    ],
  },
  {
    id: "cpp-adv-projections",
    title: "Projections & Predicate Composition",
    difficulty: "Advanced",
    icon: "🎚️",
    description:
      "Most std::ranges algorithms take an optional PROJECTION: a callable applied to each element before the comparator/predicate sees it. Instead of writing \`[](const X& x) { return x.name; }\` in every algorithm, you pass \`&X::name\` once. This makes sorts and searches read like SQL ORDER BY clauses.",
    concepts: [
      "Projection parameter on ranges algorithms",
      "Member-pointer as a callable",
      "Composing projections",
      "std::invoke as the universal call",
      "When NOT to use projections",
    ],
    bridges: {
      Python: "key= parameter on sort(), min(), max() — exactly this.",
      Rust: "sort_by_key() takes a function returning the key — same idea.",
      JavaScript: "sort((a,b)=>a.x-b.x) — without projection support you write more.",
    },
    code: \`#include <ranges>
#include <algorithm>
#include <vector>
#include <string>
#include <iostream>

struct Person {
    std::string name;
    int         age;
};

void demo() {
    std::vector<Person> ps{{"Soraia", 28}, {"Anna", 30}, {"Henry", 45}};

    // Sort by age — PROJECTION = &Person::age.
    std::ranges::sort(ps, {}, &Person::age);
    //                       ^^^^^^^^^^^^^
    // Each element x is first projected to x.age, then default-comparator (<) compares ages.

    // Sort by name length using a lambda projection.
    std::ranges::sort(ps, {}, [](const Person& p){ return p.name.size(); });

    // Find by name.
    auto it = std::ranges::find(ps, "Anna", &Person::name);

    // Min with projection — find youngest.
    auto& youngest = *std::ranges::min_element(ps, {}, &Person::age);

    // Counting matching names — projection + predicate composition.
    auto cnt = std::ranges::count_if(
        ps,
        [](const std::string& n){ return !n.empty() && n[0] == 'A'; },
        &Person::name
    );

    // STABLE_SORT with a chained projection (lambda on top of member-pointer).
    // Sort by age, ties broken by name.
    std::ranges::stable_sort(ps, {}, &Person::age);    // first by age
    std::ranges::stable_sort(ps, {}, &Person::name);   // then by name (preserves prior order for ties)
    // (For real composite keys, just write a tuple-returning projection.)

    std::ranges::sort(ps, {}, [](const Person& p) {
        return std::tie(p.age, p.name);                // compares lexicographically
    });
}

// std::invoke is the underlying mechanism.
// projection(x) is really invoke(projection, x), which handles:
//   - plain functions and lambdas
//   - member function pointers: invoke(&Class::method, obj, args...)
//   - member data pointers:     invoke(&Class::field, obj)

// WHEN NOT to use projections:
//   - You need the FULL element in the comparator (not just one field).
//   - The projection would do real work — better to materialize first.
//   - Type erasing the comparator via std::function — projection adds little.\`,
    seedQuestions: [
      "How does \`&Person::age\` work as a callable that takes a Person?",
      "Why does projection make sort by member field more readable than the C++17 form?",
      "How would you sort by composite key (age, then name) using a projection?",
      "When does std::invoke matter — what kinds of callable does it normalize?",
    ],
  },
  {
    id: "cpp-adv-ranges-pipelines",
    title: "Building Pipelines",
    difficulty: "Staff",
    icon: "🚰",
    description:
      "Production code with ranges typically composes many small views into pipelines: parse → filter → group → take. Knowing the standard view zoo and how to write data-flow code with it transforms the way you write C++. We'll look at chunking, group_by-style aggregation, and the lazy/eager line.",
    concepts: [
      "Chunking with chunk / chunk_by (C++23)",
      "Lazy aggregation via fold",
      "std::ranges::to for materialization",
      "Performance: what compiler optimizes well",
      "Where pipelines fall down (random access, sort)",
    ],
    bridges: {
      Rust: "iter().chunks(), itertools::group_by — same patterns.",
      Python: "itertools.groupby, more-itertools chunked — direct analogs.",
      SQL: "GROUP BY / OVER PARTITION mirror the patterns.",
    },
    code: \`#include <ranges>
#include <vector>
#include <string>
#include <iostream>
#include <numeric>

void demo() {
    std::vector<int> data{1,2,3,4,5,6,7,8,9,10};

    // CHUNK: fixed-size groups (C++23).
    auto chunks_of_3 = data | std::views::chunk(3);
    // → {{1,2,3},{4,5,6},{7,8,9},{10}}

    // CHUNK_BY: split where predicate is false (C++23).
    auto runs = data | std::views::chunk_by([](int a, int b){ return b == a + 1; });
    // → {{1,2,3,4,5,6,7,8,9,10}} (consecutive); with gaps you'd see splits.

    // SLIDE: overlapping windows.
    auto windows = data | std::views::slide(3);
    // → {{1,2,3},{2,3,4},{3,4,5},...}

    // FOLD — eager terminal aggregation (C++23).
    int total    = std::ranges::fold_left(data, 0, std::plus{});
    int max_so   = std::ranges::fold_left(data, INT_MIN, [](int a, int b){ return std::max(a,b); });

    // REAL PIPELINE — word frequency by initial letter.
    std::vector<std::string> words{"apple","banana","avocado","cherry","blueberry"};

    auto by_letter = words
        | std::views::transform([](const auto& w){ return std::pair{w[0], w}; });
        // → pairs of (initial, word)

    // GROUPING into a map (no ranges::group_by; combine sort + chunk_by).
    auto sorted = words;
    std::ranges::sort(sorted, {}, [](const auto& s){ return s[0]; });

    for (auto group : sorted | std::views::chunk_by(
            [](const auto& a, const auto& b){ return a[0] == b[0]; })) {
        std::cout << group.front()[0] << ':';
        for (const auto& w : group) std::cout << ' ' << w;
        std::cout << '\\n';
    }

    // MATERIALIZE with ranges::to (C++23):
    //   auto v = data | std::views::filter(odd) | std::ranges::to<std::vector>();

    // PERFORMANCE INTUITION:
    //   - filter / transform / take / drop: typically optimized to tight loops.
    //   - Compose 5–10 stages; usually fine.
    //   - Heavy state (sort, ranges::to) → real allocation.
    //   - For hottest loops, profile — sometimes a hand-written for-loop wins.

    // PITFALL: COUNTED ITERATORS / VIEWS are NOT random access by default.
    //   You can't binary_search a filtered view; you need to materialize first.
}`,
    seedQuestions: [
      "What's the difference between `views::chunk` and `views::chunk_by`?",
      "How does `slide(3)` differ from `chunk(3)` for the same input?",
      "What does `ranges::fold_left` do, and how is it different from a view?",
      "When does a hand-written loop beat a ranges pipeline?",
    ],
  },
] };
