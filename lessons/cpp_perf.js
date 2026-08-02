export const cppPerf = { name: "Performance Engineering", lessons: [
  {
    id: "cpp-adv-cache-lines",
    title: "Cache Lines, False Sharing & Padding",
    difficulty: "Staff",
    icon: "💾",
    description:
      "Modern CPUs talk to memory in 64-byte cache lines, not bytes. Two threads writing to different variables on the same line collide on cache coherence — 'false sharing' — and tank performance even though there's no logical conflict. Aligning hot, per-thread data to its own cache line is one of the highest-leverage perf wins in concurrent C++.",
    concepts: [
      "Cache hierarchy: L1/L2/L3 sizes and latencies",
      "Cache line granularity",
      "False sharing",
      "alignas / hardware_destructive_interference_size",
      "Cache-friendly data layouts (AoS vs SoA)",
    ],
    bridges: {
      Rust: "crossbeam-utils::CachePadded exists for the same reason.",
      Java: "@Contended annotation in JDK serves the same purpose.",
      Go: "Sometimes manual padding fields are used; same fix.",
    },
    code: `#include <atomic>
#include <thread>
#include <new>
#include <chrono>
#include <vector>
#include <iostream>

// BAD: two counters sharing a cache line.
struct BadCounters {
    std::atomic<long> a{0};
    std::atomic<long> b{0};
};

// GOOD: pad so each counter has its own cache line.
struct GoodCounters {
    alignas(std::hardware_destructive_interference_size) std::atomic<long> a{0};
    alignas(std::hardware_destructive_interference_size) std::atomic<long> b{0};
};

// EVEN MORE EXPLICIT.
constexpr std::size_t CACHELINE = 64;
struct PaddedCounter {
    alignas(CACHELINE) std::atomic<long> value{0};
    char pad_[CACHELINE - sizeof(std::atomic<long>)];   // ensure isolation
};

// MEASURE.
void benchmark() {
    BadCounters bad;
    GoodCounters good;

    auto bench = [](auto& s) {
        std::thread t1([&]{ for (int i = 0; i < 10'000'000; ++i) s.a.fetch_add(1, std::memory_order_relaxed); });
        std::thread t2([&]{ for (int i = 0; i < 10'000'000; ++i) s.b.fetch_add(1, std::memory_order_relaxed); });
        t1.join(); t2.join();
    };

    auto t0 = std::chrono::high_resolution_clock::now();  bench(bad);
    auto t1 = std::chrono::high_resolution_clock::now();  bench(good);
    auto t2 = std::chrono::high_resolution_clock::now();

    using ms = std::chrono::milliseconds;
    std::cout << "bad : " << std::chrono::duration_cast<ms>(t1 - t0).count() << "ms\\n";
    std::cout << "good: " << std::chrono::duration_cast<ms>(t2 - t1).count() << "ms\\n";
    // Typical gap: 3–10×.
}

// ARRAY OF STRUCTS vs STRUCT OF ARRAYS.
// AoS — natural OO layout, often cache-hostile for sweeps over one field.
struct ParticleAoS { float x, y, z; float vx, vy, vz; float m; };
std::vector<ParticleAoS> particles_aos;
// Updating just .x for 10M particles touches 28 bytes per element, evicts the rest.

// SoA — split each field into its own contiguous buffer.
struct ParticleSoA {
    std::vector<float> x, y, z, vx, vy, vz, m;
};
ParticleSoA particles_soa;
// Updating .x reads only the .x buffer — fully cache-resident, SIMD-friendly.

// LATENCY ROUGH NUMBERS (modern x86):
//   L1 hit       ~  1 ns
//   L2 hit       ~  3 ns
//   L3 hit       ~ 10 ns
//   Main RAM     ~ 60 ns
//   Page miss    ~ 200 ns+
//   Cross-socket ~ 200 ns
//   SSD random   ~ 100 us
// Cache misses dominate hot inner loops more often than instruction count.\`,
    seedQuestions: [
      "What is false sharing and why does it slow down threads that 'don't actually share data'?",
      "What does \`std::hardware_destructive_interference_size\` represent, and why is it not just a fixed 64?",
      "When does AoS beat SoA, and vice versa?",
      "Why is 'profile, then optimize layout' usually better than 'always pad everything'?",
    ],
  },
  {
    id: "cpp-adv-branch-pred",
    title: "Branch Prediction & Code Layout",
    difficulty: "Staff",
    icon: "🌳",
    description:
      "CPUs speculate which way a branch will go. Predictable branches are nearly free; mispredicts cost ~15-20 cycles each. Code patterns that fool the predictor — random data, alternating taken/not-taken — destroy throughput. Sorting first, branchless arithmetic, and \`[[likely]]\`/\`[[unlikely]]\` annotations are the practical tools.",
    concepts: [
      "Branch predictors and pipeline cost",
      "Sorting input to make branches predictable",
      "Branchless code patterns",
      "[[likely]] / [[unlikely]] (C++20)",
      "Profile-guided optimization (PGO)",
    ],
    bridges: {
      Rust: "core::hint::likely / unlikely (nightly). Same patterns apply.",
      Java: "JIT often handles this automatically; manual annotations are uncommon.",
      Assembly: "Branch hint prefixes existed historically; deprecated, replaced by smarter predictors.",
    },
    code: \`#include <vector>
#include <algorithm>
#include <chrono>
#include <iostream>
#include <random>

// THE CLASSIC DEMO — same loop, sorted vs unsorted input.
long sum_above_127(const std::vector<int>& data) {
    long s = 0;
    for (int x : data) {
        if (x >= 128) s += x;       // half-and-half if random; trivially predicted if sorted
    }
    return s;
}

void demo() {
    std::vector<int> data(1'000'000);
    std::mt19937 rng(42);
    std::uniform_int_distribution<int> d(0, 255);
    for (auto& v : data) v = d(rng);

    auto unsorted_copy = data;
    auto sorted_copy   = data;
    std::sort(sorted_copy.begin(), sorted_copy.end());

    auto bench = [](const auto& v) {
        auto t0 = std::chrono::high_resolution_clock::now();
        long s = sum_above_127(v);
        auto t1 = std::chrono::high_resolution_clock::now();
        return std::pair{s, std::chrono::duration<double, std::milli>(t1 - t0).count()};
    };

    auto [s1, ms1] = bench(unsorted_copy);
    auto [s2, ms2] = bench(sorted_copy);
    std::cout << "unsorted: " << ms1 << "ms\\n";
    std::cout << "sorted:   " << ms2 << "ms\\n";
    // Typical: 5–10× faster on sorted data despite same instruction count.
}

// BRANCHLESS arithmetic — avoid the branch entirely.
int max_branchless(int a, int b) {
    int diff = a - b;
    int mask = diff >> 31;                  // 0 if a >= b, -1 otherwise (arithmetic shift)
    return b + (diff & ~mask);              // a if a >= b else b
}
// Compilers often emit cmov/csel even for the naive \`(a > b ? a : b)\`.
// Trust the compiler first, profile, then hand-tune.

// [[likely]] / [[unlikely]] — annotate the rare branch.
int safe_div(int a, int b) {
    if (b == 0) [[unlikely]] {
        throw std::invalid_argument("div by zero");
    }
    return a / b;
}
// Compilers use this hint to lay out the hot path linearly and push cold paths off-page.

// PROFILE-GUIDED OPTIMIZATION (PGO) collects real branch frequencies from sample runs.
// gcc: -fprofile-generate, run workload, -fprofile-use. clang: similar.
// PGO typically beats manual [[likely]] in correctness and rarely loses.

// LOOP UNROLLING and AUTO-VECTORIZATION are downstream of predictable code.
// Branchless inner loops auto-vectorize; predictable inner loops can be unrolled.\`,
    seedQuestions: [
      "Why is the same loop 5-10× faster on sorted input — instructions are identical?",
      "When should you reach for [[likely]] / [[unlikely]], and when should you let PGO decide?",
      "Why is naive \`(a > b ? a : b)\` often already branchless after compilation?",
      "What does branch misprediction actually cost, mechanically — what happens in the pipeline?",
    ],
  },
  {
    id: "cpp-adv-simd",
    title: "SIMD & Vectorization",
    difficulty: "Staff",
    icon: "🧮",
    description:
      "SIMD (Single Instruction, Multiple Data) lets one instruction process 4–16 lanes at once. The compiler auto-vectorizes simple loops; for harder cases, you reach for intrinsics or the upcoming \`std::simd\`. Used well, SIMD gives 4–32× speedups on numerical workloads. Used badly, it's a maintenance nightmare.",
    concepts: [
      "Auto-vectorization conditions",
      "Manual intrinsics (SSE, AVX, NEON)",
      "std::simd (C++26 candidate / Parallelism TS)",
      "Alignment requirements",
      "Vertical vs horizontal operations",
    ],
    bridges: {
      Rust: "core::arch::x86_64 + portable_simd crate. Similar mix.",
      Java: "Vector API (jdk.incubator.vector) — same direction.",
      Numpy: "Vectorized ops at runtime; C++ moves this to compile time.",
    },
    code: \`#include <vector>
#include <immintrin.h>           // x86 SIMD intrinsics

// AUTO-VECTORIZATION conditions (loops the compiler can vectorize):
//   1. Countable: fixed iteration count, no early exits.
//   2. No data dependencies between iterations.
//   3. Contiguous memory accesses.
//   4. No function calls (or only inlined trivial ones).
//   5. No exceptions thrown inside.
//
// gcc / clang: report with -fopt-info-vec / -Rpass=loop-vectorize.

// AUTO-VECTORIZABLE.
void add_arrays(const float* a, const float* b, float* out, std::size_t n) {
    for (std::size_t i = 0; i < n; ++i) out[i] = a[i] + b[i];
}
// Compiler emits VADDPS or similar — 8 floats per AVX2 instruction.

// NOT AUTO-VECTORIZABLE — early exit + sequential dependency.
int find_first(const int* a, std::size_t n, int target) {
    for (std::size_t i = 0; i < n; ++i)
        if (a[i] == target) return i;       // early exit blocks vectorization
    return -1;
}
// Manual SIMD (sketch): load 8 ints, compare, movemask, find lowest set bit.

// MANUAL INTRINSICS — sum 8 floats at a time with AVX.
float simd_sum(const float* a, std::size_t n) {
    __m256 acc = _mm256_setzero_ps();
    std::size_t i = 0;
    for (; i + 8 <= n; i += 8) {
        __m256 v = _mm256_loadu_ps(a + i);     // unaligned load
        acc      = _mm256_add_ps(acc, v);
    }
    // Horizontal sum.
    float buf[8];
    _mm256_storeu_ps(buf, acc);
    float total = 0;
    for (auto v : buf) total += v;
    for (; i < n; ++i) total += a[i];          // tail
    return total;
}

// ALIGNMENT — aligned loads are faster on older arch, free on newer (AVX onwards).
// alignas(32) float buf[8];
// _mm256_load_ps(buf);    // requires 32-byte alignment, faulting otherwise.

// std::simd (Parallelism TS, expected in C++26):
//   namespace stdx = std::experimental;
//   stdx::native_simd<float> v(a + i);
//   v += stdx::native_simd<float>(b + i);
//   v.copy_to(out + i, stdx::element_aligned);
// Portable across SSE/AVX/NEON, no per-target #ifdef.

// HORIZONTAL vs VERTICAL operations.
//   Vertical: lane[i] op lane[i] — fast, the SIMD bread and butter.
//   Horizontal: sum-across-lanes — much slower, often a chain of shuffles.
// Design algorithms to be vertical wherever possible.

// PROFILE before SIMD. Often the wins are at higher levels (cache, allocation).\`,
    seedQuestions: [
      "What conditions does the compiler need for auto-vectorization to kick in?",
      "Why is \`find_first\` hard to auto-vectorize, and what's the SIMD trick that handles it manually?",
      "What's the difference between vertical and horizontal SIMD operations, and why care?",
      "When does std::simd (Parallelism TS) beat hand-written intrinsics, and when not?",
    ],
  },
] };
