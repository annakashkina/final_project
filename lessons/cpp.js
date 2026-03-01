export const cppLessons = { name: "C++", lessons: [
  {
    id: "cpp-raii-smart-ptrs",
    title: "RAII & Smart Pointers",
    difficulty: "Essential",
    icon: "🧠",
    description:
      "C++ ties resource lifetime to object lifetime. Smart pointers (unique_ptr, shared_ptr) make manual delete obsolete — if you understand ownership.",
    concepts: [
      "RAII (Resource Acquisition Is Initialization)",
      "std::unique_ptr — exclusive ownership",
      "std::shared_ptr — reference counting",
      "std::make_unique / std::make_shared",
      "Custom deleters",
    ],
    bridges: {
      C: "In C you malloc and free manually. C++ destructors automate the free. Smart pointers automate the destructor.",
      Rust: "Rust's Box<T> is unique_ptr, Arc<T> is shared_ptr. Same ownership ideas, but Rust enforces them at compile time.",
      Java: "Java's GC handles all cleanup. C++ RAII gives you deterministic cleanup — you know EXACTLY when resources are freed.",
    },
    code: `#include <memory>
#include <iostream>
#include <vector>

class Connection {
    std::string host_;
public:
    Connection(const std::string& host) : host_(host) {
        std::cout << "Connected to " << host_ << "\\n";
    }
    ~Connection() {
        std::cout << "Disconnected from " << host_ << "\\n";
    }
    void query(const std::string& sql) {
        std::cout << "[" << host_ << "] " << sql << "\\n";
    }
};

void unique_example() {
    // unique_ptr: exactly ONE owner. Cannot be copied.
    auto conn = std::make_unique<Connection>("db.prod");
    conn->query("SELECT * FROM users");

    // auto conn2 = conn;          // COMPILE ERROR: can't copy
    auto conn2 = std::move(conn);  // OK: transfer ownership
    // conn is now nullptr
    conn2->query("SELECT * FROM orders");
}   // conn2 destroyed here → ~Connection() called automatically

void shared_example() {
    // shared_ptr: multiple owners, ref-counted
    auto primary = std::make_shared<Connection>("db.replica");
    {
        auto backup = primary;   // ref count: 2
        backup->query("SELECT 1");
        std::cout << "refs: " << primary.use_count() << "\\n";   // 2
    }   // backup destroyed → ref count drops to 1
    std::cout << "refs: " << primary.use_count() << "\\n";       // 1
    primary->query("SELECT 2");
}   // primary destroyed → ref count 0 → ~Connection()

int main() {
    std::cout << "--- unique_ptr ---\\n";
    unique_example();
    std::cout << "\\n--- shared_ptr ---\\n";
    shared_example();
    std::cout << "\\nDone.\\n";
}`,
    seedQuestions: [
      "What happens if I forget to use std::move with a unique_ptr?",
      "When would I use shared_ptr vs unique_ptr?",
      "What does make_unique do differently from new?",
      "When exactly do destructors fire here?",
    ],
  },
  {
    id: "cpp-move-semantics",
    title: "Move Semantics & Rvalue References",
    difficulty: "Essential",
    icon: "🔀",
    description:
      "Move semantics let C++ transfer resources instead of copying them. Understanding && (rvalue references) is the key to writing efficient modern C++.",
    concepts: [
      "Lvalues vs rvalues",
      "Rvalue references (&&)",
      "std::move — cast to rvalue",
      "Move constructor & move assignment",
      "Return value optimization (RVO)",
    ],
    bridges: {
      Rust: "Rust moves by default. C++ copies by default — you opt into moves with std::move. Same concept, opposite defaults.",
      Java: "Java copies references (cheap). C++ copies entire objects (expensive) unless you move them.",
      C: "C has no move — you memcpy structs. C++ move semantics steal the internal pointer instead of copying data.",
    },
    code: `#include <iostream>
#include <vector>
#include <string>
#include <utility>

class Buffer {
    std::string name_;
    int* data_;
    size_t size_;
public:
    // Regular constructor
    Buffer(std::string name, size_t size)
        : name_(std::move(name)), data_(new int[size]), size_(size) {
        std::cout << "  Construct " << name_ << " (" << size_ << " ints)\\n";
    }

    // Copy constructor — expensive, duplicates data
    Buffer(const Buffer& other)
        : name_(other.name_ + "_copy"), data_(new int[other.size_]), size_(other.size_) {
        std::copy(other.data_, other.data_ + size_, data_);
        std::cout << "  Copy " << name_ << "\\n";
    }

    // Move constructor — cheap, steals resources
    Buffer(Buffer&& other) noexcept
        : name_(std::move(other.name_)), data_(other.data_), size_(other.size_) {
        other.data_ = nullptr;   // leave source in valid but empty state
        other.size_ = 0;
        std::cout << "  Move " << name_ << "\\n";
    }

    ~Buffer() {
        std::cout << "  Destroy " << name_ << (data_ ? "" : " (empty)") << "\\n";
        delete[] data_;
    }

    size_t size() const { return size_; }
};

Buffer make_buffer() {
    Buffer b("temporary", 1000);
    return b;   // RVO or move — never copies
}

int main() {
    std::cout << "1. Copy:\\n";
    Buffer a("original", 500);
    Buffer b = a;                    // calls copy constructor

    std::cout << "\\n2. Move:\\n";
    Buffer c = std::move(a);         // calls move constructor
    // a is now empty — don't use it!

    std::cout << "\\n3. Return value:\\n";
    Buffer d = make_buffer();        // RVO: likely no move at all

    std::cout << "\\n4. Push to vector:\\n";
    std::vector<Buffer> vec;
    vec.push_back(Buffer("vec_item", 100));  // move into vector

    std::cout << "\\nCleanup:\\n";
}`,
    seedQuestions: [
      "Why does the move constructor set other.data_ to nullptr?",
      "What's the difference between std::move and actually moving?",
      "Why is noexcept important on the move constructor?",
      "What happens to 'a' after std::move(a) — can I still use it?",
    ],
  },
  {
    id: "cpp-templates-concepts",
    title: "Templates & Concepts",
    difficulty: "Core",
    icon: "📐",
    description:
      "Templates generate code at compile time for any type. C++20 concepts finally let you constrain what types are allowed — with clear error messages.",
    concepts: [
      "Function templates",
      "Class templates",
      "C++20 concepts & requires",
      "Template argument deduction",
      "SFINAE vs concepts",
    ],
    bridges: {
      Java: "Like generics, but templates generate separate code per type (monomorphization). Concepts are like interface bounds (T extends Comparable).",
      Rust: "Rust traits = C++ concepts. Rust generics = C++ templates. Almost identical model — Rust just enforced it from day one.",
      Python: "Python duck-typing: if it has .sort(), call it. Templates are compile-time duck-typing. Concepts make the duck-typing explicit.",
    },
    code: `#include <iostream>
#include <vector>
#include <concepts>
#include <numeric>

// Basic function template
template<typename T>
T max_of(T a, T b) {
    return (a > b) ? a : b;
}

// C++20 concept: define what a type must support
template<typename T>
concept Summable = requires(T a, T b) {
    { a + b } -> std::convertible_to<T>;    // must support +
    { a += b };                              // must support +=
};

// Constrained template using concept
template<Summable T>
T sum(const std::vector<T>& items) {
    T result{};
    for (const auto& item : items) {
        result += item;
    }
    return result;
}

// Short syntax (C++20): auto with concept
void print_summable(const Summable auto& value) {
    std::cout << "Value: " << value << "\\n";
}

// Class template
template<typename T, size_t N>
class FixedStack {
    T data_[N];
    size_t top_ = 0;
public:
    void push(const T& val) {
        if (top_ >= N) throw std::overflow_error("stack full");
        data_[top_++] = val;
    }
    T pop() {
        if (top_ == 0) throw std::underflow_error("stack empty");
        return data_[--top_];
    }
    size_t size() const { return top_; }
    bool empty() const { return top_ == 0; }
};

int main() {
    // Template argument deduction — compiler figures out T
    std::cout << max_of(3, 7) << "\\n";         // T = int
    std::cout << max_of(3.14, 2.71) << "\\n";   // T = double

    // Concept-constrained function
    std::vector<int> nums = {1, 2, 3, 4, 5};
    std::cout << "sum: " << sum(nums) << "\\n";  // 15

    std::vector<std::string> words = {"hello", " ", "world"};
    std::cout << "sum: " << sum(words) << "\\n";  // "hello world"

    // sum(std::vector<std::mutex>{});  // CLEAR error: mutex doesn't satisfy Summable

    // Class template with non-type parameter
    FixedStack<std::string, 3> stack;
    stack.push("first");
    stack.push("second");
    std::cout << "popped: " << stack.pop() << "\\n";  // "second"
}`,
    seedQuestions: [
      "How is a concept different from just hoping the type works?",
      "What does the {a + b} -> std::convertible_to<T> syntax mean?",
      "Why does sum work for both int and string vectors?",
      "What error would you get without concepts if T doesn't support +?",
    ],
  },
  {
    id: "cpp-lambda-functional",
    title: "Lambdas & Functional Patterns",
    difficulty: "Core",
    icon: "λ",
    description:
      "Modern C++ lambdas are closures that capture variables from their scope. Combined with <algorithm>, they make C++ surprisingly expressive.",
    concepts: [
      "Lambda syntax [capture](params){body}",
      "Capture by value [=] vs reference [&]",
      "Generic lambdas (auto params)",
      "std::function & higher-order functions",
      "STL algorithms with lambdas",
    ],
    bridges: {
      JavaScript: "JS closures capture by reference automatically. C++ makes you choose: [=] copies, [&] references. Explicit control.",
      Python: "Like Python lambdas but multi-line and with explicit capture. Plus you choose value vs reference capture.",
      Rust: "Rust closures capture by borrow/move. C++ [&] = borrow, [=] = copy, [var = std::move(var)] = move. Same ideas, different syntax.",
    },
    code: `#include <iostream>
#include <vector>
#include <algorithm>
#include <functional>

int main() {
    std::vector<int> nums = {5, 3, 8, 1, 9, 2, 7, 4, 6};

    // Basic lambda — sort descending
    std::sort(nums.begin(), nums.end(), [](int a, int b) {
        return a > b;
    });
    // nums: {9, 8, 7, 6, 5, 4, 3, 2, 1}

    // Capture by value [=] — snapshot at creation time
    int threshold = 5;
    auto above = [=](int n) { return n > threshold; };
    // threshold changes later won't affect the lambda

    auto count = std::count_if(nums.begin(), nums.end(), above);
    std::cout << "Above " << threshold << ": " << count << "\\n";  // 4

    // Capture by reference [&] — sees current value
    int total = 0;
    std::for_each(nums.begin(), nums.end(), [&total](int n) {
        total += n;
    });
    std::cout << "Total: " << total << "\\n";  // 45

    // Generic lambda (auto) — works with any type
    auto print = [](const auto& container) {
        for (const auto& item : container) {
            std::cout << item << " ";
        }
        std::cout << "\\n";
    };

    print(nums);
    print(std::vector<std::string>{"hello", "world"});

    // Higher-order function: returns a lambda
    auto make_multiplier = [](int factor) {
        return [factor](int x) { return x * factor; };
    };

    auto triple = make_multiplier(3);
    std::cout << "triple(7) = " << triple(7) << "\\n";   // 21

    // Transform: apply function to every element
    std::vector<int> doubled;
    std::transform(nums.begin(), nums.end(),
                   std::back_inserter(doubled),
                   [](int n) { return n * 2; });
    print(doubled);

    // Partition: split by predicate
    auto it = std::partition(nums.begin(), nums.end(),
                             [](int n) { return n % 2 == 0; });
    std::cout << "Even: ";
    for (auto p = nums.begin(); p != it; ++p) std::cout << *p << " ";
    std::cout << "\\nOdd: ";
    for (auto p = it; p != nums.end(); ++p) std::cout << *p << " ";
    std::cout << "\\n";
}`,
    seedQuestions: [
      "What goes wrong if I capture 'total' by value instead of reference?",
      "Why does [=] snapshot the value — isn't that wasteful?",
      "How is a generic lambda (auto) different from a template function?",
      "What does make_multiplier actually return — what's the type?",
    ],
  },
  {
    id: "cpp-concurrency",
    title: "Threads, Mutexes & Async",
    difficulty: "Advanced",
    icon: "⚡",
    description:
      "C++ gives you threads, mutexes, and futures from the standard library. Powerful but unforgiving — data races are undefined behavior.",
    concepts: [
      "std::thread — spawning threads",
      "std::mutex & std::lock_guard",
      "std::async & std::future",
      "std::atomic — lock-free operations",
      "Race conditions & UB",
    ],
    bridges: {
      Java: "Like Thread + synchronized + Future. But C++ has no GIL and data races are undefined behavior, not just wrong results.",
      Python: "Python has the GIL — threads can't truly run in parallel for CPU work. C++ threads are real OS threads with real parallelism.",
      Rust: "Rust prevents data races at compile time. C++ trusts you to get it right — and gives you UB if you don't.",
    },
    code: `#include <iostream>
#include <thread>
#include <mutex>
#include <future>
#include <atomic>
#include <vector>
#include <numeric>

std::mutex cout_mtx;   // protect shared std::cout

void worker(int id, int iterations) {
    // lock_guard: locks on construction, unlocks on destruction (RAII)
    std::lock_guard<std::mutex> lock(cout_mtx);
    std::cout << "Worker " << id << " done (" << iterations << " iters)\\n";
}

// DATA RACE example — what NOT to do
int unsafe_counter = 0;
void unsafe_increment(int n) {
    for (int i = 0; i < n; ++i)
        unsafe_counter++;       // NOT thread-safe! Read-modify-write race
}

// Fix: std::atomic
std::atomic<int> safe_counter{0};
void safe_increment(int n) {
    for (int i = 0; i < n; ++i)
        safe_counter.fetch_add(1, std::memory_order_relaxed);
}

// async: returns a future you can wait on
long long parallel_sum(const std::vector<int>& data) {
    size_t mid = data.size() / 2;

    // Launch async task for first half
    auto future_first = std::async(std::launch::async, [&data, mid]() {
        return std::accumulate(data.begin(), data.begin() + mid, 0LL);
    });

    // Compute second half in this thread
    long long second = std::accumulate(data.begin() + mid, data.end(), 0LL);

    return future_first.get() + second;   // .get() blocks until ready
}

int main() {
    // 1. Basic threads
    std::vector<std::thread> threads;
    for (int i = 0; i < 4; ++i)
        threads.emplace_back(worker, i, (i + 1) * 100);
    for (auto& t : threads)
        t.join();   // MUST join before thread goes out of scope

    // 2. Data race
    std::thread t1(unsafe_increment, 100000);
    std::thread t2(unsafe_increment, 100000);
    t1.join(); t2.join();
    std::cout << "Unsafe: " << unsafe_counter << " (expected 200000)\\n";

    // 3. Atomic fix
    std::thread t3(safe_increment, 100000);
    std::thread t4(safe_increment, 100000);
    t3.join(); t4.join();
    std::cout << "Safe:   " << safe_counter << " (expected 200000)\\n";

    // 4. Async parallel sum
    std::vector<int> big(1'000'000);
    std::iota(big.begin(), big.end(), 1);
    std::cout << "Sum: " << parallel_sum(big) << "\\n";
}`,
    seedQuestions: [
      "Why is unsafe_counter++ a data race — what exactly can go wrong?",
      "What happens if you forget to join() a thread?",
      "Why does lock_guard use RAII — what if an exception is thrown?",
      "What's the difference between std::async and std::thread?",
    ],
  },
  {
    id: "cpp-folly-fbstring",
    title: "Real Project: folly's FBString",
    difficulty: "Project",
    icon: "📦",
    description:
      "Facebook's folly library includes FBString — a drop-in std::string replacement optimized for real-world workloads. Uses small-string optimization (SSO) with a clever three-category storage design.",
    concepts: [
      "Small-string optimization (SSO)",
      "Union-based type punning",
      "Discriminated storage categories",
      "Move semantics in practice",
      "ABI-compatible string replacement",
    ],
    bridges: {
      C: "C strings are just char arrays. FBString is what happens when you engineer a char array for production at scale.",
      Rust: "Rust's String is always heap-allocated. FBString avoids allocation for strings <= 23 bytes — the SSO that Rust chose not to do.",
      Java: "Java String is immutable + always heap. FBString is mutable, sometimes stack-only, and gives you control over allocation.",
    },
    files: [
      {
        name: "fbstring_core.h (simplified)",
        code: `// Simplified from facebook/folly/FBString.h
// Three storage categories based on string length:
//   Small  (0-22 chars):  stored inline, no heap allocation
//   Medium (23-254 chars): malloc'd, eager copy
//   Large  (255+ chars):   malloc'd, copy-on-write (refcounted)

#include <cstring>
#include <cassert>
#include <atomic>
#include <algorithm>

class fbstring_core {
    // The entire object is exactly 24 bytes — same as std::string
    struct MediumLarge {
        char* data_;
        size_t size_;
        size_t capacity_;   // highest bit encodes category
    };

    // Small string stored in-place, using the same 24 bytes
    // Last byte stores (maxSmallSize - size), so '\\0' at end means "full" small string
    static constexpr size_t maxSmallSize = sizeof(MediumLarge) - 1;  // 23

    union {
        uint8_t small_[sizeof(MediumLarge)];
        MediumLarge ml_;
    };

    enum Category : uint8_t {
        Small   = 0,
        Medium  = 0x80,
        Large   = 0x40,
    };

    // Category is stored in the HIGH BITS of the last byte
    Category category() const {
        // For small strings, last byte is (maxSmallSize - size)
        // which is always < 0x40, so high bits are 00
        // For medium/large, capacity's MSB encodes the category
        auto c = static_cast<Category>(small_[sizeof(MediumLarge) - 1] & 0xC0);
        return c;
    }

public:
    // Small string constructor — no allocation!
    fbstring_core() noexcept {
        // Set last byte to maxSmallSize (meaning size = 0)
        small_[maxSmallSize] = maxSmallSize;
    }

    fbstring_core(const char* data, size_t size) {
        if (size <= maxSmallSize) {
            // SMALL: copy into the union directly, zero alloc
            std::memcpy(small_, data, size);
            small_[size] = 0;
            small_[maxSmallSize] = static_cast<uint8_t>(maxSmallSize - size);
        } else {
            // MEDIUM or LARGE: allocate
            auto cap = std::max(size + 1, size_t(64));
            ml_.data_ = static_cast<char*>(std::malloc(cap));
            std::memcpy(ml_.data_, data, size);
            ml_.data_[size] = 0;
            ml_.size_ = size;
            ml_.capacity_ = cap | (static_cast<size_t>(Medium) << (8 * (sizeof(size_t) - 1)));
        }
    }

    // Move constructor — O(1), just memcpy the 24 bytes
    fbstring_core(fbstring_core&& other) noexcept {
        std::memcpy(this, &other, sizeof(*this));
        // Put other into empty small-string state
        other.small_[maxSmallSize] = maxSmallSize;
    }

    const char* data() const {
        return category() == Small ? reinterpret_cast<const char*>(small_) : ml_.data_;
    }

    size_t size() const {
        return category() == Small
            ? maxSmallSize - small_[maxSmallSize]   // decode from last byte
            : ml_.size_;
    }

    ~fbstring_core() {
        if (category() != Small) {
            std::free(ml_.data_);
        }
        // Small strings: nothing to free! That's the whole point.
    }
};`,
      },
      {
        name: "usage_example.cpp",
        code: `// Why SSO matters: real programs create LOTS of short strings
#include <chrono>
#include <iostream>

void benchmark() {
    auto start = std::chrono::high_resolution_clock::now();

    for (int i = 0; i < 1'000'000; ++i) {
        // With std::string: 1 million mallocs
        // With fbstring (SSO): 0 mallocs — all inline!
        fbstring_core s("hello world", 11);   // 11 chars < 23, stays small
        (void)s.size();
    }

    auto end = std::chrono::high_resolution_clock::now();
    auto ms = std::chrono::duration_cast<std::chrono::milliseconds>(end - start);
    std::cout << "1M small strings: " << ms.count() << "ms\\n";
}

// In practice: URL paths, HTTP headers, JSON keys, user names,
// error codes, config values — all under 23 chars.
// At Facebook scale: billions of strings/second.
// Avoiding those allocations is worth the complexity.

int main() {
    fbstring_core empty;
    std::cout << "empty size: " << empty.size() << "\\n";   // 0

    fbstring_core small("hello", 5);
    std::cout << "small data: " << small.data() << "\\n";   // "hello"
    std::cout << "small size: " << small.size() << "\\n";   // 5
    // No heap allocation happened ^

    fbstring_core medium("this string is definitely longer than 23 characters", 52);
    std::cout << "medium data: " << medium.data() << "\\n";
    std::cout << "medium size: " << medium.size() << "\\n";  // 52
    // This one did allocate ^

    // Move is just memcpy of 24 bytes — O(1) regardless of string size
    fbstring_core moved(std::move(medium));
    std::cout << "moved size: " << moved.size() << "\\n";    // 52

    benchmark();
}`,
      },
    ],
    seedQuestions: [
      "How does the last byte encode both 'small string size' and 'category'?",
      "Why is move just a 24-byte memcpy — what makes that safe?",
      "Why not use SSO for all strings — what's the tradeoff at 23+ chars?",
      "How does this stay the same size (24 bytes) as std::string?",
    ],
  },
] };
