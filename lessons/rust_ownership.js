export const rustOwnership = { name: "Ownership & Memory", lessons: [
  {
    id: "rust-ownership-basics",
    title: "Ownership Rules",
    difficulty: "Essential",
    icon: "🔑",
    description:
      "Rust's central idea: every value has exactly one owner, and when the owner goes out of scope, the value is dropped (freed). For heap types like String, assigning to a new variable moves ownership — the original variable becomes invalid. Stack types like integers implement Copy and are duplicated instead of moved. You can explicitly deep-copy heap data with clone().",
    concepts: [
      "One owner per value",
      "Move semantics",
      "Clone for deep copies",
      "Copy trait for stack types",
      "Scope and automatic drop",
    ],
    bridges: {
      "C++":
        "Like unique_ptr enforced at compile time for all heap types. No raw pointer aliasing, no double-free, no use-after-free — the compiler catches it.",
      Python:
        "Python uses reference counting and garbage collection — you never think about ownership. Rust eliminates the GC by proving ownership at compile time.",
      Java:
        "Java's GC handles memory automatically. Rust achieves the same safety without a GC — the compiler inserts free calls at exactly the right place.",
    },
    code: `fn main() {
    // Stack types (i32, bool, f64, char) implement Copy
    let a = 42;
    let b = a;          // COPIES the value — both valid
    println!("a={a}, b={b}");

    // Heap types (String, Vec) MOVE ownership
    let s1 = String::from("hello");
    let s2 = s1;        // s1's ownership MOVES to s2
    // println!("{s1}"); // COMPILE ERROR: value used after move
    println!("s2 = {s2}");

    // Clone: explicit deep copy (allocates new heap memory)
    let s3 = s2.clone();
    println!("s2={s2}, s3={s3}"); // both valid — separate allocations

    // Ownership and functions: passing a String moves it
    let name = String::from("Alice");
    print_greeting(name);
    // println!("{name}"); // COMPILE ERROR: name was moved into the function

    // Returning ownership back
    let msg = create_message("Bob");
    println!("{msg}");

    // Scope and drop: value freed when owner goes out of scope
    {
        let temp = String::from("temporary");
        println!("Inside: {temp}");
    } // temp is dropped (freed) here

    // Vec follows the same rules
    let v1 = vec![1, 2, 3];
    let v2 = v1;        // moves
    // println!("{v1:?}"); // COMPILE ERROR: moved
    println!("v2 = {v2:?}");
}

fn print_greeting(name: String) {
    // name is OWNED by this function
    println!("Hello, {name}!");
} // name is dropped here

fn create_message(recipient: &str) -> String {
    // Creates a String and transfers ownership to the caller
    format!("Welcome, {recipient}!")
}`,
    seedQuestions: [
      "Why does assigning s1 to s2 invalidate s1 — what would go wrong with two owners?",
      "Why do integers get copied but Strings get moved?",
      "What exactly happens to `name` when it's passed to print_greeting?",
      "When is clone() the right choice vs restructuring code to avoid it?",
    ],
  },

  {
    id: "rust-borrowing",
    title: "References & Borrowing",
    difficulty: "Essential",
    icon: "🤝",
    description:
      "Instead of transferring ownership, you can lend a value using references. An immutable reference (&T) lets you read but not modify. A mutable reference (&mut T) lets you modify, but only one can exist at a time. The borrow checker enforces: many readers OR one writer, never both. This prevents data races and use-after-free at compile time.",
    concepts: [
      "Immutable references (&T)",
      "Mutable references (&mut T)",
      "Borrowing rules",
      "References prevent use-after-free",
      "Dereferencing with *",
    ],
    bridges: {
      "C++":
        "C++ references (const T& and T&) exist but have no borrow checker. You can create dangling references freely — Rust prevents this at compile time.",
      Python:
        "Everything in Python is a reference, and any code can mutate shared objects. Rust's borrow checker guarantees no surprise mutations through shared references.",
      Java:
        "Java passes object references freely. Rust's references are similar but the compiler tracks how many exist and whether they're mutable — preventing concurrent modification bugs.",
    },
    code: `fn main() {
    // Immutable borrow: read-only access, original stays valid
    let message = String::from("hello world");
    let len = calculate_length(&message);
    println!("'{message}' is {len} chars");  // message still usable!

    // Multiple immutable borrows are fine
    let r1 = &message;
    let r2 = &message;
    println!("r1={r1}, r2={r2}"); // OK: many readers

    // Mutable borrow: one writer, no simultaneous readers
    let mut text = String::from("hello");
    modify(&mut text);
    println!("Modified: {text}");

    // The rules in action:
    let mut data = vec![1, 2, 3];

    // RULE: can't have &mut while & exists
    // let r = &data;
    // data.push(4);        // COMPILE ERROR: can't mutate while borrowed
    // println!("{r:?}");

    // RULE: only one &mut at a time
    // let m1 = &mut data;
    // let m2 = &mut data;  // COMPILE ERROR: second mutable borrow
    // m1.push(4);

    // OK: borrows don't overlap in time
    let r = &data;
    println!("Read: {r:?}");
    // r is no longer used after this point
    data.push(4);           // OK: no active borrows
    println!("After push: {data:?}");

    // Dereferencing
    let mut value = 10;
    let ref_to_value = &mut value;
    *ref_to_value += 5;     // dereference to modify
    println!("Value: {value}");

    // References prevent use-after-free
    let reference;
    {
        let short_lived = String::from("gone");
        // reference = &short_lived;  // COMPILE ERROR: borrowed value
    }                                 // doesn't live long enough
    // Compiler proves the reference would dangle
}

fn calculate_length(s: &String) -> usize {
    s.len()
    // s is a borrow — nothing is dropped when it goes out of scope
}

fn modify(s: &mut String) {
    s.push_str(" world");
}`,
    seedQuestions: [
      "Why can you have multiple &T references but only one &mut T at a time?",
      "What does the borrow checker actually prevent — can you give a concrete bug?",
      "Why is `&message` different from giving ownership to the function?",
      "What does 'borrowed value does not live long enough' mean?",
    ],
  },

  {
    id: "rust-slices",
    title: "Slices",
    difficulty: "Essential",
    icon: "🔪",
    description:
      "A slice is a reference to a contiguous portion of a collection — it doesn't own the data. String slices (&str) and array slices (&[T]) are fat pointers: they store both a pointer and a length. String literals like \"hello\" are &str slices pointing to data baked into the binary. Prefer &str over &String in function parameters to accept both owned Strings and string literals.",
    concepts: [
      "String slices (&str)",
      "Array/vector slices (&[T])",
      "Slice ranges [start..end]",
      "String literals are &'static str",
      "&str vs &String in function parameters",
    ],
    bridges: {
      "C++":
        "Like std::string_view (C++17) and std::span (C++20) — non-owning views into data. Rust slices are checked at compile time via the borrow checker.",
      Python:
        "Python's list[1:3] creates a new list (copies data). Rust's &data[1..3] creates a view — zero allocation, just a pointer and length.",
      Java:
        "Java has no direct equivalent. Arrays.copyOfRange copies data. Rust slices are zero-cost views — no copying, no new allocation.",
    },
    code: `fn main() {
    // String slices: &str is a view into a String
    let sentence = String::from("the quick brown fox");
    let first = &sentence[0..3];     // "the"
    let last = &sentence[16..19];    // "fox"
    println!("{first} ... {last}");

    // Shorthand ranges
    let s = String::from("hello");
    let start = &s[..3];    // "hel" — omit start means 0
    let end = &s[3..];      // "lo"  — omit end means len
    println!("{start} | {end}");

    // String literals are &str (baked into the binary)
    let greeting: &str = "hello, world";
    println!("{greeting}");

    // &str in functions: accepts both String and &str
    let owned = String::from("Rust");
    print_language(&owned);     // &String auto-coerces to &str
    print_language("Python");   // &str directly

    // first_word returns a slice tied to the input's lifetime
    let word = first_word(&sentence);
    println!("First word: {word}");

    // Array/vector slices: &[T]
    let numbers = vec![10, 20, 30, 40, 50];
    let middle = &numbers[1..4];  // [20, 30, 40]
    println!("Middle: {middle:?}");
    print_sum(middle);

    // Works with arrays too
    let fixed = [1, 2, 3, 4, 5];
    print_sum(&fixed[..3]);       // [1, 2, 3]
    print_sum(&fixed);            // entire array as slice
}

// Accept &str, not &String — more flexible
fn print_language(lang: &str) {
    println!("Language: {lang}");
}

fn first_word(s: &str) -> &str {
    match s.find(' ') {
        Some(pos) => &s[..pos],
        None => s,
    }
}

fn print_sum(slice: &[i32]) {
    let total: i32 = slice.iter().sum();
    println!("Sum of {:?} = {total}", slice);
}`,
    seedQuestions: [
      "Why is &str preferred over &String as a function parameter type?",
      "What makes a slice a 'fat pointer' — what two things does it store?",
      "What happens if you modify the original String while a slice exists?",
      "Why are string literals &'static str — what does 'static mean here?",
    ],
  },
] };
