export const cppOwnership = { name: "Smart Pointer Internals", lessons: [
  {
    id: "cpp-adv-unique-ptr",
    title: "unique_ptr Internals",
    difficulty: "Core",
    icon: "1️⃣",
    description:
      "unique_ptr is the simplest smart pointer: a single owner, zero overhead vs raw pointer, deletes the resource when destroyed. The interesting bits are the deleter type (encoded in the type, not stored), the empty base optimization, and array vs single-object specializations.",
    concepts: [
      "Empty base optimization for stateless deleters",
      "Type-encoded vs type-erased deleters",
      "unique_ptr<T[]> array specialization",
      "Custom deleters (FILE*, fd, OpenGL handles)",
      "Cost: literally zero over raw pointer",
    ],
    bridges: {
      Rust: "Rust's `Box<T>` is unique_ptr with `default_delete`. Custom deleters in Rust are done via Drop impls on wrapper types.",
      Java: "Java has try-with-resources for AutoCloseable. unique_ptr is type-level instead of syntactic — composes anywhere.",
      C: "C uses pairs of `create_x()` / `destroy_x()`. unique_ptr packages that pair as a type with a destructor.",
    },
    code: `#include <memory>
#include <cstdio>
#include <utility>
#include <type_traits>

// Sketch of unique_ptr's layout. Note: deleter via EBO when stateless.
template <typename T, typename D = std::default_delete<T>>
class my_unique_ptr {
    // Compressed pair trick — D as base if empty, otherwise as member.
    struct Storage : D {
        T* p;
        Storage(T* x, D d) : D(std::move(d)), p(x) {}
    } s_;
public:
    explicit my_unique_ptr(T* p = nullptr, D d = D{}) : s_(p, std::move(d)) {}
    ~my_unique_ptr() { if (s_.p) static_cast<D&>(s_)(s_.p); }

    my_unique_ptr(const my_unique_ptr&) = delete;
    my_unique_ptr(my_unique_ptr&& o) noexcept : s_(o.release(), std::move(o.get_deleter())) {}

    T* release() noexcept { return std::exchange(s_.p, nullptr); }
    D& get_deleter() noexcept { return s_; }
    T* get() const noexcept { return s_.p; }
    T& operator*() const { return *s_.p; }
};

// With stateless default_delete:    sizeof(unique_ptr<T>) == sizeof(T*)
// With a stateful lambda deleter:   sizeof grows to hold the lambda's captures.

// CUSTOM DELETERS — pattern for C resources:
struct FileCloser { void operator()(FILE* f) const { if (f) std::fclose(f); } };
using FilePtr = std::unique_ptr<FILE, FileCloser>;

FilePtr open_log() {
    return FilePtr(std::fopen("log.txt", "r"));
}

// Stateful deleter via lambda — type changes, size grows.
auto make_with_logger() {
    auto deleter = [](int* p) { delete p; };
    return std::unique_ptr<int, decltype(deleter)>(new int(42), deleter);
}

// Array specialization: unique_ptr<T[]> calls delete[], supports operator[]
void array_demo() {
    std::unique_ptr<int[]> arr(new int[10]{});
    arr[3] = 42;        // ok
    // arr->foo();      // NOT defined — array form has no operator->
}

// Why prefer make_unique over \`new\`:
//   1. Exception safety in func(make_x(), make_y()) — argument order undefined.
//   2. No raw \`new\` in your code.
//   3. Briefer.
// Cost: make_unique<T[]> value-initializes; raw new[] doesn't.

static_assert(sizeof(std::unique_ptr<int>) == sizeof(int*));`,
    seedQuestions: [
      "Why does unique_ptr with a stateless deleter cost zero extra bytes?",
      "What happens to sizeof when you use a capturing lambda as the deleter?",
      "Why does `unique_ptr<T[]>` exist as a separate specialization?",
      "What exception-safety bug does make_unique fix that `new` causes in function arguments?",
    ],
  },
  {
    id: "cpp-adv-shared-ptr",
    title: "shared_ptr Control Block",
    difficulty: "Advanced",
    icon: "🔗",
    description:
      "A shared_ptr is TWO pointers: one to the object, one to the control block holding the ref count, weak count, and deleter. make_shared fuses both into one allocation. The control block is the source of shared_ptr's flexibility — and its cost.",
    concepts: [
      "Control block layout (strong, weak, deleter, allocator)",
      "make_shared single-allocation optimization",
      "Aliasing constructor",
      "Why shared_ptr<void> works",
      "Cost: 2 pointers + atomic ops",
    ],
    bridges: {
      Rust: "Rust's `Arc<T>` is shared_ptr without the control-block flexibility — no custom deleters, no aliasing constructor, but the same atomic refcount model.",
      Java: "Every Java reference is essentially shared. The GC handles cycles. shared_ptr leaves cycles to you (use weak_ptr).",
      Swift: "ARC is the same model. Swift's `weak`/`unowned` map to weak_ptr.",
    },
    code: `#include <memory>
#include <atomic>

// Conceptual sketch — real implementations are more elaborate.
struct ControlBlockBase {
    std::atomic<long> strong{1};
    std::atomic<long> weak{1};     // counts the control block itself once
    virtual void destroy_object() noexcept = 0;
    virtual void destroy_block()  noexcept = 0;
    virtual ~ControlBlockBase() = default;
};

template <typename T>
struct ControlBlockSeparate : ControlBlockBase {
    T* ptr;
    void destroy_object() noexcept override { delete ptr; }
    void destroy_block()  noexcept override { delete this; }
};

template <typename T>
struct ControlBlockInplace : ControlBlockBase {
    alignas(T) unsigned char storage[sizeof(T)];
    T* obj() { return reinterpret_cast<T*>(storage); }
    void destroy_object() noexcept override { obj()->~T(); }
    void destroy_block()  noexcept override { delete this; }
};

// What make_shared<T>(args...) does:
//   - One allocation: ControlBlockInplace<T> { atomics... ; T inline }
//   - Object and control block share a cache line — better locality
//   - Strong refs alive: object exists
//   - Strong = 0:       destroy_object() (calls ~T but NOT the allocation)
//   - Weak  = 0:        destroy_block()  (frees the whole thing)
// PITFALL: weak_ptrs keep the BLOCK alive — including the T's bytes.
//          For a large T with long-lived weak refs, memory hangs around.

// std::shared_ptr<T> itself is two pointers:
struct shared_ptr_layout {
    void* obj_ptr;
    void* cb_ptr;        // points to the control block base
};
static_assert(sizeof(std::shared_ptr<int>) == 2 * sizeof(void*));

// Why is the obj_ptr separate? The ALIASING CONSTRUCTOR.
struct Big { int a; int b; double c; };

std::shared_ptr<Big> own = std::make_shared<Big>();
std::shared_ptr<int> alias(own, &own->a);   // shares ownership of \`own\`,
                                            // but .get() returns &own->a
// \`alias\` extends Big's lifetime; the int& is just a "view" pointer.
// Use case: hand someone a sub-object that pins the parent's allocation.

// shared_ptr<void> works because the deleter is erased into the control block.
// Construction time records HOW to delete; the type-erased deleter is invoked.
std::shared_ptr<void> erased = std::make_shared<Big>();
// At destruction, the right ~Big() runs even though static type is void.\`,
    seedQuestions: [
      "Why does \`make_shared\` allocate object and control block together — what's the downside?",
      "If a weak_ptr is alive after the last shared_ptr dies, what memory is still allocated?",
      "How does the aliasing constructor work — what does the second pointer accomplish?",
      "Why does \`shared_ptr<void>\` correctly call the right destructor?",
    ],
  },
  {
    id: "cpp-adv-weak-cycles",
    title: "weak_ptr & Breaking Cycles",
    difficulty: "Advanced",
    icon: "♾️",
    description:
      "Reference-counted cycles never decrement to zero — a classic leak. weak_ptr is a non-owning observer of a control block: it doesn't keep the object alive but can be promoted (\`lock()\`) to a shared_ptr if the object still exists. The canonical use is parent-child trees and observer patterns.",
    concepts: [
      "Cyclic ownership leak diagnosis",
      "weak_ptr::lock semantics",
      "weak_ptr::expired race-free check",
      "When to use weak_ptr in caches",
      "Bidirectional links: pick a parent direction",
    ],
    bridges: {
      Rust: "Rust's \`Weak<T>\` from \`Arc\` is identical. Rust's borrow checker doesn't prevent cycles — same hazard, same fix.",
      Java: "Java GC handles cycles automatically. C++ refcounting can't, hence weak_ptr.",
      Python: "Python uses refcount + cycle detector. C++ has refcount only — you must break cycles manually.",
    },
    code: \`#include <memory>
#include <vector>
#include <iostream>

// LEAK: cycle of shared_ptrs.
struct Node {
    std::shared_ptr<Node> next;        // owns next
    std::shared_ptr<Node> prev;        // also owns prev — CYCLE
    ~Node() { std::cout << "~Node\\n"; }
};

void cycle_leak() {
    auto a = std::make_shared<Node>();
    auto b = std::make_shared<Node>();
    a->next = b;     // a → b
    b->prev = a;     // b → a   (cycle)
    // After scope: refcounts go 2→1, not 1→0. Nothing destroyed. Leak.
}

// FIX: one direction owns, the other observes.
struct GoodNode {
    std::shared_ptr<GoodNode> next;    // strong: owns next
    std::weak_ptr<GoodNode>   prev;    // weak: observes parent
    ~GoodNode() { std::cout << "~GoodNode\\n"; }
};

// PARENT-CHILD TREE — same idiom.
struct Widget : std::enable_shared_from_this<Widget> {
    std::weak_ptr<Widget>              parent;
    std::vector<std::shared_ptr<Widget>> children;

    void add_child(std::shared_ptr<Widget> c) {
        c->parent = shared_from_this();
        children.push_back(std::move(c));
    }
};

// USE: weak_ptr in caches — cached entries don't keep objects alive.
class Cache {
    std::unordered_map<std::string, std::weak_ptr<Resource>> cache_;
public:
    std::shared_ptr<Resource> get(const std::string& key) {
        auto it = cache_.find(key);
        if (it != cache_.end()) {
            if (auto sp = it->second.lock()) return sp;   // still alive
            cache_.erase(it);                              // expired, clean up
        }
        auto r = load_resource(key);
        cache_[key] = r;                                   // stores a weak ref
        return r;
    }
};

// LOCK semantics — race-free.
void use(std::weak_ptr<int> w) {
    if (auto sp = w.lock()) {                              // atomic check-and-grab
        // sp is a real shared_ptr; object is alive until we drop sp.
        std::cout << *sp << '\\n';
    } else {
        std::cout << "expired\\n";
    }
    // NOTE: w.expired() then later using it would race with another thread
    // destroying the last shared_ptr. Always use lock(), not expired().
}`,
    seedQuestions: [
      "How does `weak_ptr::lock()` avoid the TOCTOU race that `expired()` has?",
      "In the Cache pattern, what determines when a cached resource actually disappears?",
      "Why does weak_ptr need access to the control block but not to the object pointer?",
      "If parent points to child via shared_ptr and child to parent via shared_ptr, draw the refcounts after both locals go out of scope — what's stuck?",
    ],
  },
  {
    id: "cpp-adv-shared-from-this",
    title: "enable_shared_from_this",
    difficulty: "Advanced",
    icon: "🪞",
    description:
      "Inside a member function, you sometimes need a shared_ptr to `*this` — for async callbacks, scheduling, or registering. You can't safely build one from `this` because that creates a SECOND control block. `enable_shared_from_this` stashes a weak_ptr inside the object so you can ask the existing control block for ownership.",
    concepts: [
      "Why `shared_ptr<T>(this)` is a bug",
      "Internal weak_ptr stored by base class",
      "Calling shared_from_this() before any shared_ptr exists is UB",
      "Async callback pattern",
      "weak_from_this() (C++17)",
    ],
    bridges: {
      Rust: "Rust would force this via `Arc<Self>` parameter — you can't get an Arc from a raw `&self`. C++ adds the weak_ptr inside the object.",
      Java: "Trivially supported: `this` is already a shared reference under GC.",
      Swift: "Same problem; solved with `weak self` capture lists or unowned references.",
    },
    code: `#include <memory>
#include <functional>
#include <thread>
#include <iostream>

// THE BUG — two control blocks for one object → double delete.
struct Bad : std::enable_shared_from_this<Bad> {
    std::shared_ptr<Bad> leak_self() {
        return std::shared_ptr<Bad>(this);   // ❌ creates a NEW control block
    }
};

// CORRECT — get a shared_ptr that shares the existing control block.
struct Session : std::enable_shared_from_this<Session> {
    int id;

    void start_async() {
        // Capture a shared_ptr so the Session stays alive until the lambda runs.
        auto self = shared_from_this();
        std::thread([self]() {
            std::cout << "Session " << self->id << " still alive\\n";
        }).detach();
    }
};

void usage() {
    auto s = std::make_shared<Session>();
    s->id = 7;
    s->start_async();
    // Even if \`s\` dies here, the thread keeps Session alive through \`self\`.
}

// HOW IT WORKS:
// enable_shared_from_this<T> stores a weak_ptr<T>.
// When you do \`std::make_shared<T>(...)\` or \`shared_ptr<T>(new T)\`,
// the shared_ptr constructor detects T inherits from enable_shared_from_this
// and writes itself into the embedded weak_ptr.
// Later, shared_from_this() locks that weak_ptr.

// THE GOTCHA — calling it before any shared_ptr exists.
struct Trap : std::enable_shared_from_this<Trap> {
    Trap() {
        // auto self = shared_from_this();  // ❌ UB: no shared_ptr exists yet
    }
};

// PATTERN: weak_from_this (C++17) when you don't want to extend lifetime.
struct Subscriber : std::enable_shared_from_this<Subscriber> {
    void register_with(EventBus& bus) {
        auto weak = weak_from_this();
        bus.on_event([weak](const Event& e) {
            if (auto self = weak.lock()) self->handle(e);
            // else: subscriber is gone, drop the event silently.
        });
    }
    void handle(const Event&);
};`,
    seedQuestions: [
      "Why does `shared_ptr<T>(this)` create a second control block — what does the existing one not know?",
      "What memory does enable_shared_from_this add to your type?",
      "Why is calling shared_from_this() from the constructor undefined behavior?",
      "When should you use weak_from_this() instead of shared_from_this() inside an async callback?",
    ],
  },
] };
