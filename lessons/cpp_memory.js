export const cppMemory = { name: "Memory & Allocators", lessons: [
  {
    id: "cpp-adv-placement-new",
    title: "Placement New & std::launder",
    difficulty: "Advanced",
    icon: "📍",
    description:
      "Placement new constructs an object in pre-allocated storage. It's the primitive behind std::vector, std::optional, and any container that decouples allocation from construction. The object model rules around it are subtle — and `std::launder` exists for the cases where the compiler's strict aliasing rules would otherwise let it 'forget' that an object was constructed.",
    concepts: [
      "Placement new vs ordinary new",
      "Explicit destructor calls",
      "alignas and aligned storage",
      "Object model: lifetime begins at construction",
      "When std::launder is required",
    ],
    bridges: {
      Rust: "Rust has `MaybeUninit<T>` for the 'uninitialized but typed' state. `assume_init` is morally placement new + lifetime start.",
      Java: "Java's `new` always allocates and constructs together. No equivalent.",
      C: "C uses `malloc` + manual struct setup; lifetime is whatever you say it is. C++ has formal object lifetimes — hence std::launder.",
    },
    code: `#include <new>
#include <cstddef>
#include <type_traits>
#include <utility>

// 1. Raw storage with the right size and alignment.
template <typename T>
struct Optional {
    alignas(T) std::byte storage[sizeof(T)];
    bool has_value = false;

    template <typename... Args>
    void emplace(Args&&... args) {
        // Placement new: construct T in \`storage\`. Returns T*.
        ::new (storage) T(std::forward<Args>(args)...);
        has_value = true;
    }

    T& get() {
        // We KNOW an object lives here. Compiler may not.
        // For trivial T it's fine; for non-trivial with const/ref members
        // or polymorphic types, std::launder is required to safely "rediscover" it.
        return *std::launder(reinterpret_cast<T*>(storage));
    }

    void reset() {
        if (has_value) {
            get().~T();              // explicit destructor call
            has_value = false;
        }
    }

    ~Optional() { reset(); }
};

// 2. WHEN std::launder is actually needed.
struct WithConst { const int id; int data; };

void launder_demo() {
    WithConst a{1, 100};
    // Replace a with a new object of the same type in the same storage:
    new (&a) WithConst{2, 200};

    // a.id is "still 1" from the compiler's perspective (const propagation).
    // To safely read the NEW object's id:
    int id_new = std::launder(&a)->id;     // 2
}

// 3. Aligned storage tricks — avoid std::aligned_storage (deprecated in C++23).
// Use alignas + sizeof OR std::byte arrays inside a union.
template <typename T>
union LazyStorage {
    T value;
    LazyStorage() {}        // do NOT construct value
    ~LazyStorage() {}       // owner calls value.~T() explicitly
};

// 4. Why this matters: this is how std::vector defers construction.
// vector<T> reserves capacity = raw bytes, constructs T's in-place
// on push_back, destroys them individually on erase or destruction.

// 5. Aligned operator new (C++17) for over-aligned types.
struct alignas(64) CacheLine { char data[64]; };
auto* p = new CacheLine;       // automatically uses operator new with alignment\`,
    seedQuestions: [
      "Why must you call the destructor manually when using placement new?",
      "What is the compiler 'allowed to assume' that std::launder defeats?",
      "Why doesn't \`std::vector\` just call \`new T[n]\` instead of doing placement new in a loop?",
      "When is \`std::launder\` unnecessary even though placement new was used?",
    ],
  },
  {
    id: "cpp-adv-allocators",
    title: "The Allocator Concept",
    difficulty: "Advanced",
    icon: "🧰",
    description:
      "Every STL container is parameterized by an allocator. The minimal interface is \`allocate\`, \`deallocate\`, plus rebinding via \`allocator_traits\`. Most production allocators don't store state in the allocator itself — they hold a pointer to a memory resource. Understanding the rebinding dance and the propagation traits is the gateway to pmr.",
    concepts: [
      "Allocator minimum interface",
      "allocator_traits: the real API",
      "Stateful vs stateless allocators",
      "propagate_on_container_* traits",
      "Rebinding (Allocator<U> from Allocator<T>)",
    ],
    bridges: {
      Rust: "Rust's Allocator API is similar — \`allocate\`, \`deallocate\` on a \`&self\`. Containers are generic over \`A: Allocator\`.",
      Java: "Java has no allocator concept; the GC controls everything. Direct buffers in NIO are the closest analog.",
      C: "C is malloc/free with no abstraction. C++ allocators wrap arbitrary heap implementations behind a type.",
    },
    code: \`#include <memory>
#include <vector>
#include <cstddef>
#include <new>

// MINIMAL allocator: counts allocations.
template <typename T>
struct CountingAlloc {
    using value_type = T;

    std::size_t* counter;
    explicit CountingAlloc(std::size_t* c) : counter(c) {}

    // Rebinding constructor — required for containers that allocate U != T.
    template <typename U>
    CountingAlloc(const CountingAlloc<U>& o) : counter(o.counter) {}

    T* allocate(std::size_t n) {
        ++*counter;
        return static_cast<T*>(::operator new(n * sizeof(T)));
    }
    void deallocate(T* p, std::size_t) noexcept {
        ::operator delete(p);
    }
};

template <typename T, typename U>
bool operator==(const CountingAlloc<T>& a, const CountingAlloc<U>& b) {
    return a.counter == b.counter;          // stateful equality
}
template <typename T, typename U>
bool operator!=(const CountingAlloc<T>& a, const CountingAlloc<U>& b) {
    return !(a == b);
}

void usage() {
    std::size_t n = 0;
    std::vector<int, CountingAlloc<int>> v{CountingAlloc<int>(&n)};
    v.reserve(100);                          // ++n
    // ...
}

// REBINDING: containers like std::list<int, Alloc<int>> internally need
// Alloc<Node<int>>. allocator_traits handles this:
using A   = CountingAlloc<int>;
using AT  = std::allocator_traits<A>;
using A2  = AT::rebind_alloc<double>;        // CountingAlloc<double>

// PROPAGATION traits: should the allocator be copied/moved/swapped with the container?
//   propagate_on_container_copy_assignment
//   propagate_on_container_move_assignment
//   propagate_on_container_swap
//   is_always_equal
// Default = false. For STATEFUL allocators you typically want true for some.

template <typename T>
struct PropAlloc {
    using value_type = T;
    using propagate_on_container_move_assignment = std::true_type;
    using propagate_on_container_swap            = std::true_type;
    // ...
};

// allocator_traits is what containers actually call.
// It synthesizes the parts your allocator doesn't provide.\`,
    seedQuestions: [
      "Why do containers call allocator_traits<A>::allocate instead of A::allocate directly?",
      "What goes wrong if you forget the rebinding constructor on a stateful allocator?",
      "What happens at v1 = v2 when both have different stateful allocators and propagate_on_container_copy_assignment is false?",
      "Why does the allocator's equality operator matter for containers?",
    ],
  },
  {
    id: "cpp-adv-pmr",
    title: "Polymorphic Memory Resources",
    difficulty: "Advanced",
    icon: "🌐",
    description:
      "std::pmr (C++17) decouples 'which allocator strategy?' from the container's type. The container's type becomes \`std::pmr::vector<T>\`; the strategy is a \`memory_resource*\` passed at runtime. This lets you pick a pool, arena, or upstream resource per scope without templating your entire codebase.",
    concepts: [
      "memory_resource virtual interface",
      "polymorphic_allocator: type-erased adapter",
      "Standard resources: pool, monotonic, null, new_delete",
      "Per-scope resource selection",
      "Cost: one virtual call per allocation",
    ],
    bridges: {
      Rust: "Rust has \`Allocator\` trait; \`Box<T, A>\` is generic over A. Rust prefers static dispatch; pmr is dynamic.",
      Java: "JVM has nursery, old gen, etc. — not user-selectable. pmr gives you that knob.",
      C: "Game engines write their own arena allocators per system. pmr standardizes the pattern.",
    },
    code: \`#include <memory_resource>
#include <vector>
#include <string>
#include <array>
#include <iostream>

namespace pmr = std::pmr;

// pmr containers carry an allocator pointer at runtime.
// pmr::vector<int> is essentially std::vector<int, polymorphic_allocator<int>>.

void monotonic_buffer_example() {
    std::array<std::byte, 4096> buf;
    pmr::monotonic_buffer_resource arena(buf.data(), buf.size());
    //   - Bumps a pointer on allocate.
    //   - deallocate() is a no-op.
    //   - Frees everything at destruction.
    //   - Falls back to upstream if buffer is exhausted.

    pmr::vector<int> v(&arena);
    v.reserve(1000);
    for (int i = 0; i < 1000; ++i) v.push_back(i);
    // Zero heap allocations IF 1000 ints fit in 4096 bytes.
}

void unsynchronized_pool_example() {
    pmr::unsynchronized_pool_resource pool;
    pmr::vector<pmr::string> names(&pool);
    names.emplace_back("Anna");
    names.emplace_back("Soraia");
    // Pool serves small allocations from per-size free lists.
    // Synchronized version exists for cross-thread use.
}

// PER-SCOPE selection without changing types.
void process(pmr::memory_resource* mr) {
    pmr::vector<pmr::string> scratch(mr);
    scratch.reserve(16);
    // ...
}

void caller() {
    std::array<std::byte, 64*1024> buf;
    pmr::monotonic_buffer_resource arena(buf.data(), buf.size());
    process(&arena);            // request scratch allocator
    process(pmr::new_delete_resource()); // or default heap
    process(pmr::null_memory_resource());// or panic-on-allocate
}

// pmr containers PROPAGATE the resource through nested containers.
// pmr::vector<pmr::vector<int>> with arena: inner vectors also use arena.

// Write your own resource by inheriting from memory_resource:
class LoggingResource : public pmr::memory_resource {
    pmr::memory_resource* upstream_;
public:
    explicit LoggingResource(pmr::memory_resource* up = pmr::get_default_resource())
        : upstream_(up) {}
private:
    void* do_allocate(std::size_t bytes, std::size_t align) override {
        std::cout << "alloc " << bytes << '\\n';
        return upstream_->allocate(bytes, align);
    }
    void do_deallocate(void* p, std::size_t bytes, std::size_t align) override {
        upstream_->deallocate(p, bytes, align);
    }
    bool do_is_equal(const memory_resource& o) const noexcept override {
        return this == &o;
    }
};`,
    seedQuestions: [
      "Why does pmr::vector<int> work with any allocator strategy without recompiling templates?",
      "What's the runtime cost of a polymorphic_allocator compared to std::allocator?",
      "When does monotonic_buffer_resource fall back to upstream, and what does that imply for predictability?",
      "How does pmr propagation make nested containers share the parent's resource?",
    ],
  },
  {
    id: "cpp-adv-arenas",
    title: "Arena Allocators in Practice",
    difficulty: "Staff",
    icon: "🏟️",
    description:
      "Arenas (also called regions, monotonic, bump allocators) are the highest-performance allocation strategy for short-lived bursts of data: parse trees, request scopes, per-frame data in games. The trade: O(1) allocation, no individual free, free-all-at-end. Combined with pmr, you get this performance without templatizing the world.",
    concepts: [
      "Bump-pointer allocation",
      "Alignment and padding",
      "Scratch memory pattern",
      "Per-request arena lifecycle",
      "When NOT to arena (long-lived heterogeneous lifetimes)",
    ],
    bridges: {
      Rust: "Rust crates like `bumpalo` and `typed-arena` mirror this exactly. `Bump::alloc` is bump-pointer; free is implicit at drop.",
      Java: "JVM TLAB (thread-local allocation buffer) is similar inside the GC. User code can't drive it.",
      Go: "Go has sync.Pool for reuse; not the same but addresses similar load.",
    },
    code: `#include <cstddef>
#include <cstdint>
#include <memory_resource>
#include <vector>
#include <string>

// Hand-rolled bump allocator — pedagogical version.
class BumpArena {
    std::byte* base_;
    std::byte* end_;
    std::byte* cur_;
public:
    BumpArena(void* buf, std::size_t n)
      : base_(static_cast<std::byte*>(buf)), end_(base_ + n), cur_(base_) {}

    void* allocate(std::size_t bytes, std::size_t align) {
        // Round cur_ up to alignment boundary.
        auto p = reinterpret_cast<std::uintptr_t>(cur_);
        auto aligned = (p + align - 1) & ~(align - 1);
        auto next = reinterpret_cast<std::byte*>(aligned) + bytes;
        if (next > end_) return nullptr;       // exhausted
        cur_ = next;
        return reinterpret_cast<void*>(aligned);
    }
    void reset() noexcept { cur_ = base_; }    // O(1) free-all
};

// Per-request scratch — the canonical server pattern.
struct Request {
    std::array<std::byte, 64 * 1024>   scratch_buf;
    std::pmr::monotonic_buffer_resource scratch{scratch_buf.data(), scratch_buf.size()};

    using string_t = std::pmr::string;
    using vec_t    = std::pmr::vector<string_t>;

    void handle() {
        vec_t headers(&scratch);
        headers.emplace_back("content-type: application/json");
        headers.emplace_back("cache-control: no-store");
        // ... allocate-heavy parsing ...
        // No individual frees. scratch is destroyed with Request → all freed at once.
    }
};

// WHEN NOT TO USE AN ARENA:
//   - Object lifetimes diverge sharply within the arena's life.
//   - Mutable shared state outlives the arena's reset.
//   - Sizing is wildly variable; you'll spill to upstream constantly.
//   - You need to free individual objects (use a pool instead).

// SCALING TIPS:
//   - Reserve a per-thread arena to avoid contention.
//   - Use chained/growable arenas (linked list of buffers) when sizing is unpredictable.
//   - Profile: free-all at end-of-request can dominate cache misses if data is cold.

// ALIGNMENT MATTERS: misaligned allocations may be slow (or UB on some ISAs).
// Always pass the requested alignment through, especially for SIMD types.
static_assert(alignof(std::max_align_t) >= 16);`,
    seedQuestions: [
      "Why is the bump-pointer allocate so cheap — what's the comparison to malloc's path?",
      "What happens to destructors of objects allocated in an arena when the arena resets?",
      "Why is per-thread arena better than a global one for server workloads?",
      "When would chained/growable arenas beat a fixed-size monotonic buffer?",
    ],
  },
] };
