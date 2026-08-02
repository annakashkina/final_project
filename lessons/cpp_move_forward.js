export const cppMoveForward = { name: "Move Semantics & Forwarding", lessons: [
  {
    id: "cpp-adv-rule-of-five",
    title: "Rule of 0, 3, 5, 7",
    difficulty: "Core",
    icon: "5️⃣",
    description:
      "When a class owns a resource, you must reason about destruction, copy, and move. Rule of 0: own nothing raw, get all six special members for free. Rule of 5: if you write one, write them all. The implicit generation rules are subtle — a user-defined destructor silently suppresses move generation.",
    concepts: [
      "The six special member functions",
      "Implicit suppression rules",
      "Rule of 0 with smart pointers",
      "Defaulted vs deleted vs user-provided",
      "Rule of 7 (add hash + swap)",
    ],
    bridges: {
      Rust: "Rust derives Clone/Copy and the destructor is `Drop`. Move is implicit and bitwise. C++ exposes all six as customization points — more power, more rope.",
      Java: "Java has finalize() (deprecated), clone() (broken), and no move. C++ gives you precise control where Java leaves you to the GC.",
      Python: "Python has __del__, __copy__, __deepcopy__. Comparable in spirit but Python doesn't track move/copy at the type level.",
    },
    code: `#include <memory>
#include <utility>
#include <iostream>

// Rule of 0: own nothing raw. All six members generated correctly.
struct Good {
    std::unique_ptr<int[]> data;
    std::size_t            size;
    std::string            name;
    // No ctor, no dtor, no copy/move written.
    // Compiler generates: dtor, default ctor, copy(=delete due to unique_ptr),
    //                     move ctor, move assign.
};

// Rule of 5: if you manage a raw resource, define all five.
class Buffer {
    int*  data_;
    std::size_t size_;
public:
    Buffer(std::size_t n) : data_(new int[n]{}), size_(n) {}
    ~Buffer() { delete[] data_; }

    // Copy
    Buffer(const Buffer& o) : data_(new int[o.size_]), size_(o.size_) {
        std::copy(o.data_, o.data_ + size_, data_);
    }
    Buffer& operator=(const Buffer& o) {
        Buffer tmp(o);                          // copy-and-swap
        swap(tmp);
        return *this;
    }

    // Move — noexcept is critical for std containers to actually USE the move
    Buffer(Buffer&& o) noexcept
      : data_(std::exchange(o.data_, nullptr)),
        size_(std::exchange(o.size_, 0)) {}

    Buffer& operator=(Buffer&& o) noexcept {
        Buffer tmp(std::move(o));
        swap(tmp);
        return *this;
    }

    void swap(Buffer& o) noexcept {
        std::swap(data_, o.data_);
        std::swap(size_, o.size_);
    }
};

// Footgun: user-defined destructor suppresses MOVE generation.
struct Trap {
    std::vector<int> v;
    ~Trap() { /* logging */ }
    // Now: copy is still generated, BUT move is NOT.
    // Every "move" silently becomes a copy of \`v\` — performance cliff.
};

// Fix: re-declare them explicitly.
struct Fixed {
    std::vector<int> v;
    ~Fixed() { /* logging */ }
    Fixed()                          = default;
    Fixed(const Fixed&)              = default;
    Fixed& operator=(const Fixed&)   = default;
    Fixed(Fixed&&) noexcept          = default;
    Fixed& operator=(Fixed&&) noexcept = default;
};`,
    seedQuestions: [
      "Why does defining a destructor disable move generation but not copy?",
      "Why is noexcept on the move constructor critical for std::vector behavior?",
      "What does std::exchange buy you over `o.data_ = nullptr; return tmp;`?",
      "When would you prefer copy-and-swap over assigning fields directly?",
    ],
  },
  {
    id: "cpp-adv-universal-refs",
    title: "Universal References & Reference Collapsing",
    difficulty: "Advanced",
    icon: "🔁",
    description:
      "`T&&` in a deduced context (templates, auto) is a 'forwarding reference' — it binds to anything and the deduced T encodes the original category. Reference collapsing rules (& + & = &, & + && = &, && + && = &&) make this work. Outside of deduced contexts, `T&&` is always an rvalue reference.",
    concepts: [
      "Forwarding vs rvalue references",
      "Reference collapsing rules",
      "Why `auto&&` binds anything",
      "T&& on a class template parameter",
      "decltype(x) vs decltype((x))",
    ],
    bridges: {
      Rust: "Rust has separate `&T`, `&mut T` references; no universal reference. Generics use trait bounds (`AsRef`, `Borrow`) instead.",
      Java: "Java has only one kind of reference. Forwarding is a non-issue — there's nothing to preserve.",
      C: "C has only `T*`. None of this exists.",
    },
    code: `#include <type_traits>
#include <utility>
#include <string>

// In a deduced context, T&& is a FORWARDING reference.
template <typename T>
void f(T&& x);            // x: forwarding reference

// In a non-deduced context, T&& is an RVALUE reference.
template <typename T>
struct Holder {
    void set(T&& x);      // x: rvalue reference (T is fixed by Holder<T>)
};

// auto&& is always forwarding.
auto demo = []{
    int  a = 1;
    int& b = a;
    f(a);                 // T = int&,    x: int& &&   collapses to int&
    f(b);                 // T = int&,    x: int& &&   collapses to int&
    f(42);                // T = int,     x: int&&     stays  int&&
    f(std::move(a));      // T = int,     x: int&&

    auto&& r1 = a;        // int&
    auto&& r2 = 42;       // int&&
    static_assert(std::is_same_v<decltype(r1), int&>);
    static_assert(std::is_same_v<decltype(r2), int&&>);
};

// Reference collapsing table:
//   T& &   → T&
//   T& &&  → T&
//   T&& &  → T&
//   T&& && → T&&

// THE classic forwarding-reference puzzle.
struct Widget {};
void overload_set(Widget&);            // (1) lvalue
void overload_set(const Widget&);      // (2) const lvalue
void overload_set(Widget&&);           // (3) rvalue

template <typename T>
void dispatch(T&& w) {
    // Naive: calls overload (1) always, because \`w\` itself is an lvalue.
    overload_set(w);

    // Correct: preserve category via std::forward<T>.
    overload_set(std::forward<T>(w));
}

// Why? Inside the function, the named parameter w is an LVALUE.
// std::forward<T>(w) is essentially:
//   if T is U&,  return w (lvalue)
//   if T is U,   return static_cast<U&&>(w) (xvalue)
// This is why std::forward needs the explicit T.\`,
    seedQuestions: [
      "Why is \`void f(Widget&&)\` an rvalue reference but \`template<class T> void f(T&&)\` is a forwarding reference?",
      "What does reference collapsing produce for \`int& &&\` and why?",
      "Why does \`overload_set(w)\` inside \`dispatch\` always pick the lvalue overload?",
      "Why does \`std::forward\` need an explicit template argument when \`std::move\` doesn't?",
    ],
  },
  {
    id: "cpp-adv-perfect-forwarding",
    title: "Perfect Forwarding",
    difficulty: "Advanced",
    icon: "📡",
    description:
      "Perfect forwarding means passing arguments through a function template with their original value category preserved. It's how \`make_unique\`, \`emplace_back\`, and every modern wrapper avoids unnecessary copies. The mechanics: forwarding reference parameter + std::forward<T> in the body.",
    concepts: [
      "std::forward<T> mechanics",
      "Variadic perfect forwarding",
      "Constructor traps with forwarding refs",
      "Why std::forward is not std::move",
      "Pitfalls: hijacking copy constructors",
    ],
    bridges: {
      Rust: "Rust doesn't need this — generics take ownership or borrows explicitly. The closest analog is generic \`impl<T: Into<U>>\`.",
      Java: "Java reference semantics make all 'forwarding' trivial. Nothing to preserve.",
      Python: "Python *args/**kwargs forwarding is automatic. C++ pays for value semantics with this complexity.",
    },
    code: \`#include <memory>
#include <utility>
#include <vector>
#include <string>

// emplace_back-style: variadic perfect forwarding to a constructor.
template <typename T, typename... Args>
std::unique_ptr<T> my_make_unique(Args&&... args) {
    return std::unique_ptr<T>(new T(std::forward<Args>(args)...));
    //                              ^^^^^^^^^^^^^^^^^^^^^^^^^^
    // Each arg keeps its original category — lvalues stay lvalues,
    // rvalues stay rvalues. No spurious copies, no surprise moves.
}

struct Person {
    std::string name;
    int age;
    Person(std::string n, int a) : name(std::move(n)), age(a) {}
};

void usage() {
    std::string s = "Anna";
    auto p1 = my_make_unique<Person>(s, 30);            // s passed as lvalue → copies into n
    auto p2 = my_make_unique<Person>(std::move(s), 30); // moves into n
}

// CLASSIC TRAP: forwarding constructor hijacks copy.
struct Wrapper {
    template <typename T>
    Wrapper(T&& x) {}                    // takes anything, INCLUDING \`const Wrapper&\`!

    // Now \`Wrapper w2 = w;\` calls the template, not the copy ctor.
    // Result: T deduces to \`Wrapper&\` and weird things happen.
};

// Fix: constrain with concepts (C++20) or enable_if (C++17).
#include <concepts>
struct WrapperFixed {
    template <typename T>
        requires (!std::same_as<std::remove_cvref_t<T>, WrapperFixed>)
    WrapperFixed(T&& x) {}

    WrapperFixed(const WrapperFixed&) = default;
    WrapperFixed(WrapperFixed&&)      = default;
};

// std::forward vs std::move:
//   std::move(x)         : always casts to xvalue. Use when you OWN the value.
//   std::forward<T>(x)   : conditional cast — only to xvalue if T was a value type.
//                          Use INSIDE a forwarding-reference template.

template <typename T>
void wrong(T&& x) {
    sink(std::move(x));        // BUG: even lvalue inputs get moved-from!
}
template <typename T>
void right(T&& x) {
    sink(std::forward<T>(x));  // OK: preserves category
}

void sink(auto&&);             // dummy declaration\`,
    seedQuestions: [
      "Why does the forwarding template constructor 'hijack' the copy constructor?",
      "What concretely goes wrong if you use std::move instead of std::forward inside a forwarding template?",
      "Why does std::forward need explicit \`<T>\` but std::move doesn't?",
      "When variadic-forwarding to a constructor, what happens if one of the Args... is non-copyable?",
    ],
  },
  {
    id: "cpp-adv-move-only",
    title: "Move-Only Types & move_if_noexcept",
    difficulty: "Advanced",
    icon: "🚚",
    description:
      "Move-only types model unique resources: file handles, sockets, unique_ptr, jthread. Designing them well means deleting copy, making move noexcept, and reasoning about the 'moved-from' state. \`std::move_if_noexcept\` is what containers use to preserve the strong exception guarantee during reallocation.",
    concepts: [
      "Delete-copy idiom",
      "Moved-from but valid state",
      "Why move ops should be noexcept",
      "std::move_if_noexcept",
      "Vector reallocation guarantee",
    ],
    bridges: {
      Rust: "Move-only is Rust's default — every type without Copy. The 'moved-from = unusable' invariant is enforced at compile time.",
      Java: "Java has no move concept. The closest pattern is 'transfer ownership' via setting the old reference to null.",
      Python: "Python lacks move semantics. Move-only resources are simulated by raising on second use.",
    },
    code: \`#include <utility>
#include <type_traits>
#include <vector>
#include <stdexcept>

class FileHandle {
    int fd_ = -1;
public:
    explicit FileHandle(int fd) : fd_(fd) {}
    ~FileHandle() { if (fd_ != -1) ::close(fd_); }

    // Delete copy
    FileHandle(const FileHandle&)            = delete;
    FileHandle& operator=(const FileHandle&) = delete;

    // Move: noexcept, leaves source valid-but-empty
    FileHandle(FileHandle&& o) noexcept : fd_(std::exchange(o.fd_, -1)) {}
    FileHandle& operator=(FileHandle&& o) noexcept {
        if (this != &o) {
            if (fd_ != -1) ::close(fd_);
            fd_ = std::exchange(o.fd_, -1);
        }
        return *this;
    }

    int fd() const { return fd_; }
    bool valid() const { return fd_ != -1; }
};

// "Valid but unspecified" — the moved-from object must:
//   - be destructible
//   - be assignable
//   - have its invariants intact (so methods don't crash)
// It need NOT have any specific value.

// move_if_noexcept: returns rvalue ref only if move is noexcept,
// otherwise returns const lvalue ref (forcing a copy).
// This is why vector reallocation prefers types with noexcept move:
struct ThrowingMove {
    ThrowingMove(ThrowingMove&&)  /* not noexcept */ { /* may throw */ }
    ThrowingMove(const ThrowingMove&) {}
};

// When std::vector reallocates:
//   - If T's move is noexcept     → moves elements (fast)
//   - If only copy is noexcept    → copies elements (preserves strong guarantee)
//   - If both can throw           → moves anyway (basic guarantee only)

// To verify what your type allows:
static_assert(std::is_nothrow_move_constructible_v<FileHandle>);
static_assert(!std::is_copy_constructible_v<FileHandle>);

// PATTERN: return by value from a factory; consumer gets ownership.
FileHandle open_log(const char* path) {
    int fd = ::open(path, O_RDONLY);
    if (fd == -1) throw std::runtime_error("open failed");
    return FileHandle(fd);     // mandatory elision — no move actually runs
}`,
    seedQuestions: [
      "What does 'valid but unspecified' actually require — what operations must still work on a moved-from object?",
      "Why does vector reallocation downgrade to copy if move isn't noexcept?",
      "What's wrong with leaving fd_ at its original value after move instead of -1?",
      "Why is the self-assignment check `if (this != &o)` needed in move assign but rare in copy assign with copy-and-swap?",
    ],
  },
] };
