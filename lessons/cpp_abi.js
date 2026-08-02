export const cppAbi = { name: "Linkage, ODR & ABI", lessons: [
  {
    id: "cpp-adv-odr",
    title: "The One Definition Rule",
    difficulty: "Advanced",
    icon: "🪞",
    description:
      "Every entity in a C++ program must have exactly one definition across all translation units. Inline functions and templates can have one PER TU, as long as the definitions are identical. ODR violations are silent and devastating — undefined behavior the compiler usually can't catch.",
    concepts: [
      "ODR scope: per TU vs whole program",
      "When inline allows multiple definitions",
      "ODR violations and their symptoms",
      "static vs anonymous namespace for internal linkage",
      "inline variables (C++17)",
    ],
    bridges: {
      Rust: "Crate-based compilation makes ODR almost automatic. Cross-crate items have linkage names; conflicts are rare.",
      Java: "Class loaders enforce one definition per loader; cross-loader conflicts are detected at link time.",
      Go: "Package boundaries plus the linker handle this; no ODR concept exposed to users.",
    },
    code: `// THE RULE in five lines:
//
//   1. Every entity (function, variable, type) needs exactly one definition.
//   2. Definitions of the SAME entity in DIFFERENT TUs are ODR violations
//      EXCEPT for: inline functions/variables, templates, classes — provided
//      every TU sees IDENTICAL tokens.
//   3. Identical means literally identical including macros and using declarations.
//   4. Violations are UB. The compiler is not required to diagnose.
//   5. Linkers see mangled names; mismatched-but-named-same definitions get
//      randomly picked, leading to baffling runtime bugs.

// VIOLATION 1: same function, two TUs.
// a.cpp:  int foo() { return 1; }
// b.cpp:  int foo() { return 2; }       // UB: link order picks one
// Fix: declare in a header, define in ONE TU. Or make it static / anonymous.

// VIOLATION 2: same class, different definitions in different TUs.
// header_a.h:  struct S { int x; };
// header_b.h:  struct S { int x; double y; };
// Including different headers in different TUs gives each TU its own view of S.
// sizeof(S) and member offsets diverge — silent disaster.
// Fix: ONE canonical definition in ONE header.

// INLINE allows MULTIPLE definitions if IDENTICAL.
// header.h:
//   inline int compute(int x) { return x * 2; }
// Each TU including this gets a definition; linker picks one; all are identical → OK.

// inline VARIABLES (C++17).
// header.h:
//   inline int counter = 0;          // ONE shared variable across all TUs
// Pre-C++17 you needed a separate .cpp file. Now header-only globals are clean.

// STATIC and ANONYMOUS NAMESPACE — give internal linkage (per-TU symbol).
namespace { int helper() { return 42; } }   // visible only in this TU
static int other_helper() { return 7; }     // same effect, older syntax

// EACH TU gets its own copy. No ODR issue because they're different entities.

// CLASS DEFINITIONS in headers — implicitly inline. As long as every TU sees the
// same tokens, you're fine. Macros that differ between TUs can break this:
//
//   header.h:
//     struct Config {
//       #ifdef DEBUG
//       int extra_field;
//       #endif
//       int data;
//     };
// One TU with DEBUG, another without → DIFFERENT Config types, undetected.

// THE TWO BEST DEFENSES:
//   1. Never define functions or variables in unguarded headers without \`inline\`.
//   2. Avoid conditional layouts (members inside #ifdef) in shared types.

// TEMPLATES are implicitly inline — same identical-definition rule.
// Template instantiation in many TUs is fine; non-identical specializations are UB.\`,
    seedQuestions: [
      "What's the symptom of a 'same struct, different fields' ODR violation that the linker won't catch?",
      "Why does \`inline\` allow multiple definitions, and what must be true about them?",
      "Why are anonymous-namespace functions a clean way to share code between TUs locally?",
      "How does an \`#ifdef\` inside a class definition turn into a hard-to-find ODR bug?",
    ],
  },
  {
    id: "cpp-adv-linkage",
    title: "Linkage, Visibility & inline",
    difficulty: "Advanced",
    icon: "🔗",
    description:
      "Linkage decides which symbols are visible across translation units and shared libraries. External linkage (default for non-static at namespace scope) participates in linking; internal linkage stays in the TU. On shared libraries, visibility attributes control the EXPORTED interface — and getting this wrong causes either huge binaries or runtime symbol-not-found failures.",
    concepts: [
      "External / internal / no linkage",
      "extern \"C\" and name mangling",
      "Symbol visibility on shared libraries",
      "Position-independent code (PIC/PIE)",
      "Static initialization order (briefly)",
    ],
    bridges: {
      Rust: "pub keyword + the crate boundary. extern \"C\" with #[no_mangle] is identical syntax for FFI.",
      Java: "public/private at the class level; ClassLoader for runtime.",
      Go: "Capitalization is the visibility marker (Exported vs internal).",
    },
    code: \`// THREE KINDS of linkage in C++:
//   - EXTERNAL: visible across TUs. Default for namespace-scope functions/variables.
//   - INTERNAL: visible only in its TU. static or anonymous namespace.
//   - NO LINKAGE: locals, type names in function scope, etc.

// EXTERNAL linkage (default).
int g_count = 0;                                  // shared across TUs that declare it extern.
extern int g_count;                               // declaration in other TU

// INTERNAL linkage — won't conflict with same name in other TUs.
namespace { int local_count = 0; }
static int file_local = 0;

// EXTERN "C" — disable name mangling for C interop.
extern "C" int strlen(const char*);
extern "C" {
    void my_c_api(int);
    int  another(double);
}
// Inside extern "C" you can't overload (no mangling to disambiguate).

// SHARED LIBRARY visibility (Unix-like systems).
//   By default on Linux: every symbol is exported (a maintenance nightmare).
//   Best practice: compile with -fvisibility=hidden, then opt-in the API surface.

#define API __attribute__((visibility("default")))

API void public_api();                            // exported
void hidden_helper();                             // hidden by build flag

// On Windows the rules are inverted: __declspec(dllexport) / dllimport must be explicit.
#ifdef _WIN32
  #define API_W __declspec(dllexport)
#else
  #define API_W __attribute__((visibility("default")))
#endif

// HEADER-ONLY libraries: every consuming TU may emit the same code.
//   - Use \`inline\` on free functions to dedupe at link time.
//   - Use \`inline constexpr\` variables for shared constants.
//   - Avoid static-storage state — each TU sees its own copy.

// STATIC INITIALIZATION ORDER between TUs is UNSPECIFIED.
//   Two globals in TU_A and TU_B that depend on each other — disaster.
//
// Fixes:
//   1. constinit — guaranteed constant-initialized before any dynamic init.
//   2. The Construct On First Use idiom (singleton-style):
const auto& get_registry() {
    static const auto& r = *new SomeRegistry();    // constructed on first call
    return r;
}

// POSITION INDEPENDENT CODE.
//   Required for shared libraries on most platforms (PIC).
//   PIE (executables) is the default in modern toolchains.
//   Adds a tiny runtime cost; enables ASLR.

// SHARED LIB ABI:
//   - Function names: mangled per Itanium ABI on Unix, MS ABI on Windows.
//   - Inline functions still get definitions in each consumer TU.
//   - Changing inline function bodies breaks NOTHING at the symbol level —
//     but two-version mismatches can corrupt state.\`,
    seedQuestions: [
      "Why is \`-fvisibility=hidden\` a sane default for shared libraries?",
      "What does \`extern \"C\"\` do at the symbol level, and what does it prevent?",
      "How does the 'construct on first use' idiom dodge the static init order problem?",
      "Why does Windows invert the default (explicit export) compared to Linux (default export)?",
    ],
  },
  {
    id: "cpp-adv-abi-stability",
    title: "ABI Stability & Library Design",
    difficulty: "Staff",
    icon: "🪙",
    description:
      "An ABI (Application Binary Interface) is the runtime contract between your library and its consumers: function signatures (mangled), struct layouts, vtable layouts, exception types. Breaking it forces every consumer to recompile. Stable ABIs constrain library evolution; understanding them shapes API design choices.",
    concepts: [
      "ABI vs API",
      "What breaks ABI (and what doesn't)",
      "PImpl idiom for hiding implementation",
      "ABI of inline functions vs non-inline",
      "C++ standard library and the std::string ABI saga",
    ],
    bridges: {
      Rust: "Rust deliberately has NO stable ABI between compiler versions. extern \"C\" is the stable path.",
      Swift: "Swift defined a stable ABI in 5.0; very ambitious.",
      Java: "JVM bytecode is the ABI; very stable across decades.",
    },
    code: \`// API: the source-level contract (function names, types).
// ABI: the binary contract (mangled names, sizes, layouts, calling convention).
//
// You can preserve API while breaking ABI — and that's the danger.

// CHANGES THAT BREAK ABI:
//   1. Adding/removing/reordering NON-STATIC data members of a class.
//   2. Adding/removing/reordering VIRTUAL functions.
//   3. Changing the function signature of a non-inline function.
//   4. Changing const/noexcept/return type on an exported function.
//   5. Changing the visibility/access of virtual functions.
//   6. Adding a default template argument is OK only if the type has no other ABI tie.

// CHANGES THAT KEEP ABI:
//   - Adding non-virtual member functions defined inline.
//   - Adding new free functions / overloads.
//   - Adding/removing PRIVATE non-data members (functions, types).
//   - Adding new types entirely.

// THE PIMPL IDIOM — decouple ABI from implementation.
class Widget {
public:
    Widget();
    ~Widget();
    Widget(Widget&&) noexcept;
    Widget& operator=(Widget&&) noexcept;
    void render() const;
private:
    struct Impl;                                  // incomplete in the header
    std::unique_ptr<Impl> p_;                     // PUBLIC ABI: a single pointer
};
// In the cpp:
//   struct Widget::Impl { int x; std::vector<int> data; /* freely changeable */ };
//   Widget::Widget() : p_(std::make_unique<Impl>()) {}
//   Widget::~Widget() = default;                 // must be in .cpp because Impl is incomplete in header
//
// You can add/remove fields in Impl without breaking ABI. The price: heap allocation
// + indirection per Widget.

// INLINE FUNCTIONS and ABI.
//   - An inline function defined in a header: every consumer TU emits a copy.
//   - Change the body, recompile consumer → consumer uses NEW body.
//   - But cached compiled consumers still use OLD body. Mixed versions = UB.

// STD::STRING ABI SAGA (libstdc++).
//   GCC 5+: switched std::string to a new ABI (Cow → SSO).
//   _GLIBCXX_USE_CXX11_ABI macro selects which. Mixing TUs with different macro
//   values gives ODR violations across the std::string symbol.
//   Lesson: even the standard library's ABI is a moving target.

// PRACTICAL TACTICS for ABI-stable libraries:
//   - Keep public types small and PImpl'd.
//   - Don't expose templates that touch implementation (or do, and version them).
//   - Use extern "C" + opaque pointers for the truly stable C-style interface.
//   - Version your symbols with namespace inline or symbol versioning (.so version scripts).

inline namespace v1 {
    void publish(int);                            // mangled into v1
}
// v2 can introduce a new symbol; old binaries linked to v1::publish keep working.

// REALITY CHECK:
//   Most internal-only libraries don't need ABI stability. Choose simplicity.
//   Public/shared libraries do — design accordingly from day one.\`,
    seedQuestions: [
      "What's the difference between API and ABI, and why does it matter for shared libraries?",
      "How does the PImpl idiom give you ABI stability, and what does it cost at runtime?",
      "Why is the std::string ABI famous as a cautionary tale?",
      "What does \`inline namespace v1\` give you that a regular namespace doesn't?",
    ],
  },
] };
