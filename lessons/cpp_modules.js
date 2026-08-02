export const cppModules = { name: "Modules", lessons: [
  {
    id: "cpp-adv-modules-basics",
    title: "Module Structure & Imports",
    difficulty: "Advanced",
    icon: "📦",
    description:
      "C++20 modules replace 40 years of header-based code organization. A module is a compiled unit (a BMI — binary module interface) with explicit exports. No more textual `#include`, no more macro leakage, vastly faster compile times. Adoption is gradual; most projects mix modules and headers.",
    concepts: [
      "Module declaration and export",
      "Module interface vs implementation units",
      "Why headers are slow (TU duplication)",
      "Binary Module Interfaces (BMIs)",
      "Header units as a migration path",
    ],
    bridges: {
      Rust: "Crates + modules give similar separate compilation. Cargo manages BMIs implicitly.",
      Java: "package + import — same shape, runtime resolution rather than compile-time.",
      Python: "import is conceptually the same. Modules in C++ are far more about compile-time.",
    },
    code: `// math.cppm — module interface unit (file extension varies by compiler)

export module math;                              // declare this unit's module

export int square(int x) { return x * x; }      // exported
int internal(int x) { return x + 1; }            // not exported — module-local

// EXPORT a namespace block.
export namespace math {
    constexpr double pi = 3.14159265358979;
    constexpr double e  = 2.71828182845905;
}

// IMPORTING — in a consumer translation unit.
//   import math;
//   int x = math::square(7);
//   double r = math::pi;

// IMPLEMENTATION UNIT — companion to the interface, not exported.
//   // math_impl.cpp
//   module math;        // attached to module math (no export)
//   int internal(int x) { return x + 1; }    // shared internal helper

// SUBMODULES / PARTITIONS — split a module across multiple files.
//   // math-trig.cppm
//   export module math:trig;
//   export double sin_taylor(double);
//
//   // math.cppm
//   export module math;
//   export import :trig;        // re-export the partition

// CONSUMER:
//   import math;                // gets both math and math:trig

// COMPILE MODEL:
//   1. Compile math.cppm → math.pcm (BMI).
//   2. Compile consumer.cpp, asks the compiler "I need math" → reads math.pcm.
//   3. No re-parsing of math interface.
//
// Builds get faster because each import is parse-once.

// HEADER UNITS — bridge from existing headers.
//   import <vector>;            // imports a standard header AS A MODULE
//   import "my_header.h";       // imports a project header as a module
// These let you progressively migrate without rewriting consumers.

// MIGRATION REALITY (as of 2026):
//   - Compiler support: clang ≥ 16 + libc++ headers; gcc ≥ 13; MSVC ≥ 19.30.
//   - Build systems: cmake ≥ 3.28 (with proper ninja), Bazel needs config.
//   - Conventions evolving — file extensions vary (.cppm, .ixx, .mxx).
//   - std::print, std::format, etc. ship as headers; modular std lib is partial.

// PROS:
//   - Vastly faster builds for large projects.
//   - No macro leakage between modules.
//   - Cleaner symbol-visibility semantics.
//
// CONS:
//   - Tooling immaturity (IDEs, refactoring tools catching up).
//   - Mixed-mode builds (some headers, some modules) need careful BMI management.
//   - Conditional compilation patterns (#ifdef) get awkward.\`,
    seedQuestions: [
      "Why are compile times so much faster with modules — what's the redundant work in header-based builds?",
      "What's the difference between a module interface unit and an implementation unit?",
      "How do header units help with gradual migration from headers to modules?",
      "What practical problems with macros in headers do modules solve outright?",
    ],
  },
  {
    id: "cpp-adv-modules-partitions",
    title: "Partitions, BMIs & Build Systems",
    difficulty: "Staff",
    icon: "🧱",
    description:
      "Partitions split a module across many files without changing the consumer interface. BMIs are compiler-specific binary blobs that carry the module's exports; they're created by the compiler, consumed by build systems, and break when compiler versions change. Understanding the build mechanics is what turns 'modules in theory' into 'modules in production'.",
    concepts: [
      "Module partition syntax",
      "BMI artifact lifecycle",
      "CMake module support",
      "Compiler version sensitivity",
      "Where module dependencies live in the build graph",
    ],
    bridges: {
      Rust: "Cargo manages crate boundaries and rebuilds — equivalent.",
      Java: "javac handles module graph; tooling similar.",
      Go: "Package compilation is incremental and tracked automatically; conceptually closer than headers ever were.",
    },
    code: \`// PARTITIONS — split internal pieces of one module across files.
//
// // math-trig.cppm
//   export module math:trig;
//   export double sin_taylor(double);
//
// // math-linalg.cppm
//   export module math:linalg;
//   export double dot(const double*, const double*, std::size_t);
//
// // math.cppm
//   export module math;
//   export import :trig;
//   export import :linalg;
//   // Optional: extra exports here, or re-exports curated.

// FROM the consumer's perspective:
//   import math;       // sees sin_taylor and dot via re-exports

// BMI ARTIFACTS:
//   clang: .pcm  (precompiled module)
//   gcc:   .gcm
//   msvc:  .ifc
// They are NOT portable between compiler versions or even minor patch versions.
// Cache them per (compiler-version × flags × platform).

// CMAKE SUPPORT (≥ 3.28).
//   add_library(math STATIC)
//   target_sources(math
//     PUBLIC FILE_SET CXX_MODULES FILES
//       math.cppm
//       math-trig.cppm
//       math-linalg.cppm
//     PRIVATE
//       math-impl.cpp)
//   target_compile_features(math PUBLIC cxx_std_20)
//
// CMake handles dependency scanning (P1689 format) so the build graph
// knows that consumer.cpp depends on math.pcm before compiling consumer.cpp.

// BUILD GRAPH (logical):
//   math-trig.cppm     → math-trig.pcm
//   math-linalg.cppm   → math-linalg.pcm
//   math.cppm + above  → math.pcm
//   consumer.cpp + math.pcm → consumer.o
//
// Parallelism wins when sibling partitions can compile concurrently.

// COMMON FRICTION POINTS:
//   1. Header units (import <vector>) need built-in standard module support.
//      Some libc++ / libstdc++ versions ship modular std partially.
//   2. Tools that scan code (clang-tidy, IDEs) need module-aware preprocessors.
//   3. Macros do NOT cross module boundaries — surprising for legacy code.
//   4. BMI invalidation must be triggered by ANY change in transitive exports.

// PRACTICAL ADVICE:
//   - Start migration at the leaves: small, header-only libraries become modules first.
//   - Don't try to modularize an entire codebase in one PR.
//   - Lock down compiler+stdlib versions tightly; the BMI cache is sensitive.
//   - Profile cold and warm builds before committing to deep refactors.\`,
    seedQuestions: [
      "What problem do partitions solve that simply having multiple module interface units doesn't?",
      "Why are BMIs not portable between compiler versions — what's stored inside?",
      "How does CMake know that \`consumer.cpp depends on math.pcm\` before compiling it?",
      "Why is it pragmatic to modularize 'from the leaves' rather than all at once?",
    ],
  },
] };
