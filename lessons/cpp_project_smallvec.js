export const cppProjectSmallVec = { name: "Project: small_vector", lessons: [
  {
    id: "cpp-adv-smallvec-design",
    title: "Designing small_vector: Inline Storage",
    difficulty: "Project",
    icon: "🎒",
    description:
      "A `small_vector<T, N>` keeps its first N elements inline (no allocation), then grows to the heap when overflowing. Used by LLVM, Folly, and Boost. Building one teaches: placement new at scale, allocator integration, exception safety with two storage modes, and the union/aligned-storage dance.",
    concepts: [
      "Two storage modes via union or aligned bytes",
      "size_/capacity_/data_ invariants",
      "Construct, destroy, copy/move across modes",
      "Growth strategy and amortized O(1) push",
      "Exception safety during reallocation",
    ],
    bridges: {
      Rust: "smallvec crate is the direct counterpart. Same inline-N-then-heap design.",
      Java: "Java's ArrayList always allocates; small_vec is C++-specific.",
      LLVM: "llvm::SmallVector is the canonical implementation; battle-tested.",
    },
    files: [
      {
        name: "small_vector.h (header)",
        code: `// small_vector<T, N> — inline-storage vector. Allocates on heap only after size > N.
// Educational version; production code (LLVM, Folly) handles more edge cases.

#pragma once

#include <cstddef>
#include <memory>
#include <type_traits>
#include <new>
#include <utility>
#include <stdexcept>

template <typename T, std::size_t N>
class small_vector {
    // Inline storage: aligned bytes large enough for N T's.
    alignas(T) std::byte inline_buf_[sizeof(T) * N];

    T*          data_     = inline_data();   // either points to inline_buf_ or heap
    std::size_t size_     = 0;
    std::size_t capacity_ = N;

    T* inline_data()       { return reinterpret_cast<T*>(inline_buf_); }
    const T* inline_data() const { return reinterpret_cast<const T*>(inline_buf_); }
    bool is_inline() const { return data_ == inline_data(); }

public:
    using value_type = T;

    small_vector() = default;

    ~small_vector() {
        clear();
        if (!is_inline()) ::operator delete(data_, std::align_val_t{alignof(T)});
    }

    // Copy: respect source's mode independent of ours.
    small_vector(const small_vector& o) {
        reserve(o.size_);
        for (std::size_t i = 0; i < o.size_; ++i) ::new (data_ + i) T(o.data_[i]);
        size_ = o.size_;
    }

    // Move: if source is inline, must copy/move element-by-element.
    //       If source is heap, can steal the pointer.
    small_vector(small_vector&& o) noexcept(std::is_nothrow_move_constructible_v<T>) {
        if (o.is_inline()) {
            for (std::size_t i = 0; i < o.size_; ++i) ::new (data_ + i) T(std::move(o.data_[i]));
            size_ = o.size_;
            o.clear();
        } else {
            data_      = std::exchange(o.data_,     o.inline_data());
            size_      = std::exchange(o.size_,     0);
            capacity_  = std::exchange(o.capacity_, N);
        }
    }

    std::size_t size()      const { return size_; }
    std::size_t capacity()  const { return capacity_; }
    bool        empty()     const { return size_ == 0; }

    T&       operator[](std::size_t i)       { return data_[i]; }
    const T& operator[](std::size_t i) const { return data_[i]; }

    void clear() noexcept {
        for (std::size_t i = 0; i < size_; ++i) data_[i].~T();
        size_ = 0;
    }

    template <typename... Args>
    void emplace_back(Args&&... args) {
        if (size_ == capacity_) grow();
        ::new (data_ + size_) T(std::forward<Args>(args)...);
        ++size_;
    }

    void push_back(const T& v) { emplace_back(v); }
    void push_back(T&& v)      { emplace_back(std::move(v)); }

    void reserve(std::size_t new_cap) {
        if (new_cap <= capacity_) return;
        grow_to(new_cap);
    }

private:
    void grow() {
        // Exponential growth: 1.5–2× is the typical sweet spot.
        grow_to(capacity_ == 0 ? N : capacity_ * 2);
    }

    void grow_to(std::size_t new_cap) {
        // Allocate aligned heap storage.
        T* new_data = static_cast<T*>(
            ::operator new(sizeof(T) * new_cap, std::align_val_t{alignof(T)}));

        // Move elements, with strong guarantee if move is noexcept.
        std::size_t i = 0;
        try {
            if constexpr (std::is_nothrow_move_constructible_v<T>) {
                for (; i < size_; ++i) ::new (new_data + i) T(std::move(data_[i]));
            } else {
                for (; i < size_; ++i) ::new (new_data + i) T(data_[i]);  // copy
            }
        } catch (...) {
            for (std::size_t j = 0; j < i; ++j) new_data[j].~T();
            ::operator delete(new_data, std::align_val_t{alignof(T)});
            throw;
        }

        // Tear down old storage.
        for (std::size_t j = 0; j < size_; ++j) data_[j].~T();
        if (!is_inline()) ::operator delete(data_, std::align_val_t{alignof(T)});

        data_     = new_data;
        capacity_ = new_cap;
    }
};`,
      },
      {
        name: "small_vector_demo.cpp (usage)",
        code: `#include "small_vector.h"
#include <string>
#include <iostream>

void demo() {
    small_vector<std::string, 4> v;     // inline capacity 4

    v.push_back("first");
    v.push_back("second");
    v.push_back("third");
    v.push_back("fourth");
    // Still inline — no heap allocation.

    v.push_back("fifth");
    // Crossed N; grew to heap.

    for (std::size_t i = 0; i < v.size(); ++i)
        std::cout << v[i] << '\\n';
}

// REAL-WORLD USAGE PATTERNS:
//   - Argument lists, AST nodes — usually small, occasionally large.
//   - Per-frame allocations in games and graphics.
//   - LLVM's IR data structures use SmallVector pervasively.

// KEY PERFORMANCE WINS:
//   - 0 mallocs for the common (small) case.
//   - Spatial locality: elements live next to the owning object.
//   - Lower TLB pressure compared to heap-allocated vectors.

// TRADEOFFS:
//   - sizeof(small_vector<T,N>) grows with N. Don't pick N huge.
//   - The "small or heap" branch lives at every method (predictable branch).
//   - Move from inline is element-by-element — N moves, not one pointer swap.
//   - ABI is fragile: changing N changes the type.

// COMMON BUG TO AVOID:
//   Storing pointers/references INTO the small_vector across a grow().
//   When growing from inline to heap, all addresses change.
//   Same hazard exists for std::vector — but more frequent with small_vector
//   because growth happens "for surprising reasons".\`,
      },
    ],
    seedQuestions: [
      "Why must move-from-inline copy elements individually instead of swapping pointers?",
      "What does the \`grow_to\` function's try/catch achieve — what's the safety guarantee?",
      "When is std::vector strictly better than small_vector?",
      "How does the inline-vs-heap branch in every method play with branch prediction?",
    ],
  },
  {
    id: "cpp-adv-smallvec-allocator",
    title: "Allocator-Aware small_vector",
    difficulty: "Project",
    icon: "🧪",
    description:
      "Making \`small_vector\` allocator-aware is the next step: respect propagation traits, integrate with pmr, support stateful allocators. This is what separates a 'demo' from a 'production-ready' container. The standard library's containers do all of this; you get to see how the sausage is made.",
    concepts: [
      "Allocator stored in the container",
      "allocator_traits dispatch for construct/destroy",
      "propagate_on_container_* traits handling",
      "EBO for stateless allocators",
      "pmr::small_vector for runtime resource selection",
    ],
    bridges: {
      Rust: "Rust SmallVec doesn't have allocator API yet (stable). C++ goes further here.",
      Folly: "folly::small_vector is allocator-aware and PolicyConfigurable.",
      LLVM: "Trades allocator support for a simpler API (uses malloc directly).",
    },
    files: [
      {
        name: "alloc_small_vector.h",
        code: \`// Allocator-aware small_vector.
// Stores the allocator (via EBO when stateless), routes alloc/construct through allocator_traits.

#pragma once
#include <cstddef>
#include <memory>
#include <type_traits>
#include <new>
#include <utility>

template <typename T, std::size_t N, typename Allocator = std::allocator<T>>
class small_vector {
    using AT = std::allocator_traits<Allocator>;

    // EBO via inheritance from Allocator when stateless.
    struct Storage : Allocator {
        alignas(T) std::byte inline_buf[sizeof(T) * N];
        T*          data     = nullptr;          // patched in ctor
        std::size_t size     = 0;
        std::size_t capacity = N;
        Storage(const Allocator& a) : Allocator(a) {}
    } s_;

    T*       inline_data()       { return reinterpret_cast<T*>(s_.inline_buf); }
    const T* inline_data() const { return reinterpret_cast<const T*>(s_.inline_buf); }
    bool     is_inline()   const { return s_.data == inline_data(); }

    Allocator&       alloc()       { return s_; }
    const Allocator& alloc() const { return s_; }

public:
    explicit small_vector(const Allocator& a = {}) : s_(a) { s_.data = inline_data(); }

    ~small_vector() {
        clear();
        if (!is_inline()) AT::deallocate(alloc(), s_.data, s_.capacity);
    }

    template <typename... Args>
    void emplace_back(Args&&... args) {
        if (s_.size == s_.capacity) grow();
        AT::construct(alloc(), s_.data + s_.size, std::forward<Args>(args)...);
        ++s_.size;
    }

    void clear() noexcept {
        for (std::size_t i = 0; i < s_.size; ++i)
            AT::destroy(alloc(), s_.data + i);
        s_.size = 0;
    }

    std::size_t size() const { return s_.size; }
    T& operator[](std::size_t i) { return s_.data[i]; }

private:
    void grow() {
        std::size_t new_cap = s_.capacity == 0 ? N : s_.capacity * 2;
        T* new_data = AT::allocate(alloc(), new_cap);
        std::size_t i = 0;
        try {
            if constexpr (std::is_nothrow_move_constructible_v<T>) {
                for (; i < s_.size; ++i)
                    AT::construct(alloc(), new_data + i, std::move(s_.data[i]));
            } else {
                for (; i < s_.size; ++i)
                    AT::construct(alloc(), new_data + i, s_.data[i]);  // copy
            }
        } catch (...) {
            for (std::size_t j = 0; j < i; ++j) AT::destroy(alloc(), new_data + j);
            AT::deallocate(alloc(), new_data, new_cap);
            throw;
        }
        for (std::size_t j = 0; j < s_.size; ++j) AT::destroy(alloc(), s_.data + j);
        if (!is_inline()) AT::deallocate(alloc(), s_.data, s_.capacity);
        s_.data     = new_data;
        s_.capacity = new_cap;
    }
};

// Make it pmr-friendly:
namespace pmr {
    template <typename T, std::size_t N>
    using small_vector = ::small_vector<T, N, std::pmr::polymorphic_allocator<T>>;
}

// USAGE with a per-scope arena:
//   std::array<std::byte, 4096> buf;
//   std::pmr::monotonic_buffer_resource arena(buf.data(), buf.size());
//   pmr::small_vector<int, 8> v(&arena);     // first 8 inline; overflow into arena
//
//   This composes the locality win of inline storage with the burst-friendly
//   bump-allocator of a monotonic_buffer_resource.\`,
      },
      {
        name: "propagation_test.cpp",
        code: \`// PROPAGATION TRAITS — what happens on copy, move, swap when allocators differ.
// allocator_traits exposes:
//   propagate_on_container_copy_assignment  (POCCA)
//   propagate_on_container_move_assignment  (POCMA)
//   propagate_on_container_swap             (POCS)
//   is_always_equal
// For std::allocator: all false / always_equal=true (allocators are interchangeable).
// For stateful allocators: you may want POCS=true so swap exchanges allocators too.

#include "alloc_small_vector.h"
#include <memory_resource>

void propagation_demo() {
    // Two arenas, two pmr small_vectors.
    std::array<std::byte, 1024> b1, b2;
    std::pmr::monotonic_buffer_resource a1(b1.data(), b1.size());
    std::pmr::monotonic_buffer_resource a2(b2.data(), b2.size());

    pmr::small_vector<int, 4> v1(&a1);
    pmr::small_vector<int, 4> v2(&a2);

    v1.emplace_back(1); v1.emplace_back(2);
    v2.emplace_back(10);

    // SWAP: depends on POCS for polymorphic_allocator.
    //   polymorphic_allocator has is_always_equal = false, POCS = false.
    //   So swapping containers with DIFFERENT resources is UB unless we move.
    //   Production small_vector would gate this and either move-element-wise or assert.

    // MOVE between containers with different allocators:
    //   POCMA = false → fall back to element-wise move (not pointer swap).
    //   v2 = std::move(v1);   // moves elements one-by-one, using v2's allocator.
}

// DESIGN LESSON.
// A production allocator-aware container is mostly about getting THESE FOUR TRAITS right:
//   - POCCA controls copy-assignment behavior.
//   - POCMA controls move-assignment behavior.
//   - POCS  controls swap behavior.
//   - is_always_equal lets you specialize when allocators compare equal trivially.
//
// Get them right → your container composes with any allocator.
// Get them wrong → silent UB on assign/swap with mismatched allocators.\`,
      },
    ],
    seedQuestions: [
      "Why use \`allocator_traits::construct\` instead of just \`::new\` placement new?",
      "Why does the allocator inherit-into-Storage trick provide EBO for stateless allocators?",
      "What does propagate_on_container_swap actually control, and what's the failure mode if you get it wrong?",
      "What does combining inline storage with a monotonic_buffer_resource give you that neither alone does?",
    ],
  },
] };
