export const cppExceptions = { name: "Exception Safety", lessons: [
  {
    id: "cpp-adv-safety-guarantees",
    title: "The Three Safety Guarantees",
    difficulty: "Advanced",
    icon: "🛡️",
    description:
      "Operations on objects provide one of three exception guarantees: nothrow (cannot throw), strong (commit-or-rollback to prior state), basic (no leaks, but state may change). Every interface implicitly promises one. Knowing which is the difference between code that fails gracefully and code that leaks resources on the first exception.",
    concepts: [
      "Nothrow / strong / basic / no guarantee",
      "Copy-and-swap for strong guarantee",
      "noexcept as part of the interface",
      "STL invariants: which containers give which guarantees",
      "RAII as the foundation",
    ],
    bridges: {
      Rust: "Rust panics; recovery is rare. The Rust model is closer to 'abort on impossibility'. Exception safety is a C++ idiom.",
      Java: "Checked exceptions force interfaces to declare what they throw. C++ relies on noexcept and convention.",
      Python: "Pythonic code 'asks forgiveness'. C++ exception safety is more rigorous because resources are explicit.",
    },
    code: `#include <vector>
#include <memory>
#include <stdexcept>
#include <utility>

// THE THREE GUARANTEES (Abrahams).
//   1. NOTHROW: operation cannot throw. Critical for swap, move, destructors.
//   2. STRONG : if it throws, observable state is unchanged.
//   3. BASIC  : if it throws, no resource leaks; object remains usable (some valid state).

// COPY-AND-SWAP for STRONG guarantee.
class Buffer {
    std::unique_ptr<int[]> data_;
    std::size_t            size_ = 0;
public:
    void assign(const Buffer& other) {
        Buffer tmp(other);          // step 1: copy (may throw — state unchanged)
        swap(tmp);                  // step 2: noexcept swap — atomic-ish commit
    }                               // tmp destroyed cleanly with old data

    void swap(Buffer& o) noexcept {
        std::swap(data_, o.data_);
        std::swap(size_, o.size_);
    }
};
// If the copy throws: tmp is destroyed, *this is unchanged. STRONG.
// If the swap "throws": it can't, it's noexcept.

// CONTAINER guarantees you can rely on:
//   vector::push_back              — strong   IF T's move is noexcept OR T is copyable
//   vector::insert (middle)        — basic
//   vector::emplace_back           — same as push_back
//   vector::operator[]             — nothrow (no bounds check, no UB if in-range)
//   vector::at                     — strong  (throws on OOB; container unchanged)
//   map::insert                    — strong
//   map::operator[]                — strong if no default-ctor throw

// WHY noexcept matters on MOVE.
struct Loud {
    Loud(Loud&&) noexcept { /* steal pointers */ }       // noexcept
    Loud(const Loud&)     { /* copy */ }
};
// std::vector<Loud>::reallocate prefers MOVE because it's nothrow.
// If move were throwing, vector copies instead — to preserve strong guarantee.

// noexcept as INTERFACE.
class Resource {
public:
    void release() noexcept;       // promise: never throws. Callers depend on this.
    ~Resource()  noexcept;         // destructors are implicitly noexcept since C++11.
};
// Destructors that DO throw (and propagate) call std::terminate. Don't.

// THE BASIC GUARANTEE IN PRACTICE.
void process(std::vector<int>& v) {
    v.push_back(1);                // strong
    try {
        do_risky_thing();          // might throw
    } catch (...) {
        // v has 1 extra element if do_risky_thing threw.
        // Container is intact (basic), but logical state has drifted.
        throw;                     // re-throw, caller handles
    }
}

// PRINCIPLE: prefer STRONG at API boundaries, BASIC internally for performance,
// NOTHROW for move/swap/destruction.\`,
    seedQuestions: [
      "Why does noexcept move enable vector's strong-guarantee reallocation?",
      "How does copy-and-swap convert 'multiple risky steps' into a strong-guarantee single operation?",
      "What happens when a destructor throws during stack unwinding from another exception?",
      "Why are some STL operations only basic and not strong — what's the cost trade?",
    ],
  },
  {
    id: "cpp-adv-noexcept-design",
    title: "noexcept: Interface Contract",
    difficulty: "Advanced",
    icon: "🚫",
    description:
      "\`noexcept\` is a promise to the type system: 'this function cannot escape with an exception'. The compiler uses it to optimize (no unwind tables, no destructor cleanup paths) and the standard library uses it as a dispatch criterion. Misuse — promising noexcept then throwing — calls std::terminate. The conditional form \`noexcept(expr)\` lets generic code propagate the property.",
    concepts: [
      "noexcept keyword and noexcept operator",
      "Conditional noexcept(noexcept(expr))",
      "When std::terminate is called",
      "Move/swap/dtor noexcept conventions",
      "Cost: smaller binaries, better optimization",
    ],
    bridges: {
      Rust: "Rust functions can be marked \`#[no_panic]\` (community) or use Result types to disallow panics. noexcept is the closest builtin.",
      Java: "Java has \`throws\` declaration enforced at compile time. C++ noexcept is enforced at RUNTIME (with terminate).",
      Python: "No equivalent. Python relies on documentation.",
    },
    code: \`#include <vector>
#include <utility>
#include <type_traits>

// 1. SIMPLE noexcept.
int identity(int x) noexcept { return x; }

// Calling a throwing function from a noexcept function COMPILES.
// But if an exception ESCAPES, std::terminate runs.
void bad() noexcept {
    throw std::runtime_error("oops");   // OK to throw, but at escape: terminate.
}

// 2. CONDITIONAL noexcept — propagate the property.
template <typename T>
void swap_them(T& a, T& b) noexcept(noexcept(T(std::declval<T>())) &&
                                    noexcept(std::declval<T&>() = std::declval<T>())) {
    T tmp(std::move(a));
    a = std::move(b);
    b = std::move(tmp);
}
// Simpler: use std::is_nothrow_*_v traits.
template <typename T>
void swap_them2(T& a, T& b) noexcept(std::is_nothrow_move_constructible_v<T> &&
                                     std::is_nothrow_move_assignable_v<T>) {
    using std::swap;
    swap(a, b);
}

// 3. noexcept OPERATOR — query whether an expression is noexcept.
static_assert( noexcept(identity(0)));
static_assert(!noexcept(bad()));

// 4. STANDARD CONVENTIONS.
class Resource {
public:
    Resource(Resource&&)            noexcept;       // moves should be noexcept
    Resource& operator=(Resource&&) noexcept;
    ~Resource()                     noexcept;       // destructors implicit noexcept

    void swap(Resource&)            noexcept;
    // copy ops MAY throw (allocation). Don't promise noexcept unless really sure.
};

// 5. ALL DESTRUCTORS ARE noexcept BY DEFAULT (C++11+).
struct Throwing {
    ~Throwing() noexcept(false) {                   // explicit opt-out
        throw std::runtime_error("yikes");
    }
};
// During stack unwinding (already in flight), a second exception → terminate.

// 6. noexcept and TEMPLATE METAPROGRAMMING — see if T's ops are nothrow.
template <typename T>
void emplace(std::vector<T>& v, T&& x) {
    if constexpr (std::is_nothrow_move_constructible_v<T>) {
        v.push_back(std::move(x));                  // move OK on reallocation
    } else {
        v.push_back(x);                             // copy to keep strong guarantee
    }
}

// 7. COSTS YOU OPT INTO without noexcept.
// Every non-noexcept call site keeps unwind metadata: exception tables,
// landing pads, RAII cleanup paths. On hot paths this matters.
// Mark provably-non-throwing functions noexcept.\`,
    seedQuestions: [
      "What happens at runtime if a noexcept function tries to propagate an exception?",
      "How does conditional noexcept let generic code adapt to its T?",
      "Why are destructors implicitly noexcept since C++11, and how do you opt out?",
      "What hidden runtime cost does a non-noexcept function add to its callers?",
    ],
  },
  {
    id: "cpp-adv-exception-safe-class",
    title: "Designing an Exception-Safe Class",
    difficulty: "Staff",
    icon: "🪖",
    description:
      "Exception safety isn't free — you design for it. The recipe: every member with a destructor manages itself (RAII), every operation is structured as 'allocate everything first, commit last', and you respect Abrahams' two-phase construction rule. A walk-through of a real resource-managing class shows the choices in context.",
    concepts: [
      "RAII for every owned resource",
      "Two-phase construction (acquire, commit)",
      "Strong-guarantee operator= via copy-and-swap",
      "Why destructor noexcept is non-negotiable",
      "Auditing for exception leaks",
    ],
    bridges: {
      Rust: "Rust's RAII (Drop) is unconditional — no exceptions, no double-fault hazard. Different model, same hygiene principles.",
      Java: "try-with-resources gives partial RAII. Exception safety in Java is simpler thanks to GC.",
      Python: "Context managers (\`with\`) play the RAII role.",
    },
    code: \`#include <memory>
#include <vector>
#include <string>
#include <utility>

// Multi-resource class designed for STRONG guarantee.
class Document {
    std::string             title_;
    std::vector<std::string> pages_;
    std::unique_ptr<int[]>   index_;    // page-index lookup table
    std::size_t              index_size_ = 0;

public:
    // CONSTRUCTOR — allocate everything; if any step throws, prior ones unwind cleanly.
    Document(std::string title, std::vector<std::string> pages)
      : title_(std::move(title))
      , pages_(std::move(pages))
      , index_(std::make_unique<int[]>(pages_.size()))
      , index_size_(pages_.size())
    {
        for (std::size_t i = 0; i < pages_.size(); ++i) index_[i] = static_cast<int>(i);
        // If make_unique throws: title_ and pages_ destroyed → OK.
        // If the loop throws: index_, title_, pages_ all destroyed → OK.
    }

    // DEFAULT DESTRUCTOR — noexcept by default, all members RAII.
    ~Document() = default;

    // MOVE — noexcept, just transfers handles.
    Document(Document&&) noexcept            = default;
    Document& operator=(Document&&) noexcept = default;

    // COPY — may throw, leaves *this unchanged on failure (STRONG).
    Document(const Document& o)
      : title_(o.title_)
      , pages_(o.pages_)
      , index_(std::make_unique<int[]>(o.index_size_))
      , index_size_(o.index_size_)
    {
        std::copy_n(o.index_.get(), index_size_, index_.get());
    }

    Document& operator=(const Document& o) {
        Document tmp(o);                      // may throw — *this untouched
        swap(tmp);                            // noexcept commit
        return *this;
    }                                         // tmp destroyed cleanly

    void swap(Document& o) noexcept {
        using std::swap;
        swap(title_,      o.title_);
        swap(pages_,      o.pages_);
        swap(index_,      o.index_);
        swap(index_size_, o.index_size_);
    }

    // MUTATION with STRONG guarantee — build new state in tmp, swap on success.
    void rebuild_index(const std::vector<int>& new_order) {
        if (new_order.size() != pages_.size()) throw std::invalid_argument("size mismatch");
        auto tmp_index = std::make_unique<int[]>(pages_.size());   // may throw
        std::copy(new_order.begin(), new_order.end(), tmp_index.get());

        index_ = std::move(tmp_index);                              // noexcept commit
    }
};

// AUDIT CHECKLIST:
//   1. Every owned resource is RAII (unique_ptr, vector, string, ...).
//   2. No raw new/delete pairs.
//   3. Destructors don't throw.
//   4. Move operations are noexcept.
//   5. Mutations: build new state first, commit with a noexcept swap/assign.
//   6. Self-assignment safe (copy-and-swap is automatically so).

// SMELL: a member function that uses \`try { do_a(); do_b(); } catch(...) { ... }\`
// suggests two non-atomic resource changes. Refactor: build-then-commit.\`,
    seedQuestions: [
      "Why is copy-and-swap automatically self-assignment safe?",
      "What does 'two-phase construction' mean in the rebuild_index example?",
      "How does designing every member as RAII let the constructor automatically unwind on partial failure?",
      "Why is it a smell to have try/catch around two consecutive mutations of the same object?",
    ],
  },
] };
