export const rustCollections = { name: "Collections & Iterators", lessons: [
  {
    id: "rust-vectors",
    title: "Vectors",
    difficulty: "Core",
    icon: "📋",
    description:
      "Vec<T> is Rust's growable, heap-allocated array. It owns its elements, can push and pop, and provides both safe (.get() returns Option) and direct (indexing, panics on out-of-bounds) access. Vectors are the most commonly used collection in Rust.",
    concepts: [
      "Vec::new() and vec! macro",
      "push/pop and indexing",
      ".get() returns Option (safe access)",
      "Iterating vectors",
      "Enum variants for mixed-type storage",
    ],
    bridges: {
      "C++":
        "Like std::vector<T>. Same push_back/pop_back, same contiguous memory. Rust adds Option-based safe access with .get().",
      Python:
        "Like list, but all elements must be the same type. Use enum variants to store mixed types instead of Python's duck typing.",
      Java:
        "Like ArrayList<T>. Rust's vec! macro is like List.of() but mutable. No autoboxing — Vec<i32> stores ints directly.",
    },
    code: `fn main() {
    let mut scores = vec![85, 92, 78];
    let mut names: Vec<String> = Vec::new();

    scores.push(95);
    names.push("Alice".to_string());
    names.push("Bob".to_string());
    let last = scores.pop(); // returns Option<i32>
    println!("Popped: {:?}", last); // Some(95)

    // Direct index (panics if out of bounds)
    println!("First score: {}", scores[0]);

    // Safe access with .get() (returns Option)
    match scores.get(99) {
        Some(val) => println!("Score: {val}"),
        None => println!("No score at index 99"),
    }

    // Iterate by reference (borrows the vec)
    for score in &scores {
        println!("  score: {score}");
    }

    // Mutable iteration
    for score in &mut scores {
        *score += 5; // curve all scores up by 5
    }
    println!("Curved: {scores:?}");

    // Capacity vs length
    let mut buf: Vec<u8> = Vec::with_capacity(1024);
    println!("len={}, capacity={}", buf.len(), buf.capacity());
    buf.push(1);
    println!("len={}, capacity={}", buf.len(), buf.capacity());

    // Mixed types via enum variants
    #[derive(Debug)]
    enum Cell { Int(i64), Float(f64), Text(String) }

    let row: Vec<Cell> = vec![
        Cell::Int(1), Cell::Text("Alice".to_string()), Cell::Float(3.14),
    ];
    for cell in &row {
        match cell {
            Cell::Int(n) => print!("{n}\t"),
            Cell::Float(f) => print!("{f:.2}\t"),
            Cell::Text(s) => print!("{s}\t"),
        }
    }
    println!();
}`,
    seedQuestions: [
      "What's the difference between scores[99] and scores.get(99)?",
      "Why does iterating with &scores borrow the vector instead of consuming it?",
      "How does Vec handle capacity — what happens when you push past it?",
      "Why use enum variants for mixed types instead of something like Python's list?",
    ],
  },

  {
    id: "rust-hashmaps",
    title: "HashMaps",
    difficulty: "Core",
    icon: "🗺️",
    description:
      "HashMap<K, V> stores key-value pairs with O(1) average lookup. The entry API lets you conditionally insert or update values. HashMap takes ownership of keys and values — understanding this is essential for working with string keys.",
    concepts: [
      "HashMap<K,V> creation and access",
      "Entry API for conditional insert",
      "Iterating key-value pairs",
      "Ownership of keys and values",
      "Counting patterns with entry",
    ],
    bridges: {
      "C++":
        "Like std::unordered_map<K,V>. Entry API is similar to try_emplace. Same hash-table performance characteristics.",
      Python:
        "Like dict. The entry API does what dict.setdefault() or collections.Counter does — but more explicit about mutation.",
      Java:
        "Like HashMap<K,V>. Entry API is like computeIfAbsent/merge. Rust owns the keys; Java just holds references.",
    },
    code: `use std::collections::HashMap;

fn main() {
    // Create and insert
    let mut scores: HashMap<String, i32> = HashMap::new();
    scores.insert("Alice".to_string(), 92);
    scores.insert("Bob".to_string(), 87);

    // Access with .get() — returns Option<&V>
    if let Some(score) = scores.get("Alice") {
        println!("Alice: {score}");
    }

    // Overwrite: insert with existing key replaces the value
    scores.insert("Bob".to_string(), 91);

    // Entry API: insert only if key is absent
    scores.entry("Charlie".to_string()).or_insert(75);
    scores.entry("Alice".to_string()).or_insert(0); // no effect, Alice exists
    println!("{scores:?}");

    // Iterate key-value pairs (order is not guaranteed)
    for (name, score) in &scores {
        println!("  {name}: {score}");
    }

    // Classic pattern: word frequency counter
    let text = "the cat sat on the mat the cat";
    let mut freq: HashMap<&str, u32> = HashMap::new();

    for word in text.split_whitespace() {
        let count = freq.entry(word).or_insert(0);
        *count += 1;
    }
    println!("Word frequencies: {freq:?}");

    // Ownership: HashMap takes ownership of String keys
    let key = String::from("Dave");
    scores.insert(key, 88);
    // println!("{key}"); // COMPILE ERROR: key was moved into the map

    // Using &str references avoids the move (if data lives long enough)
    let data = String::from("the quick brown fox");
    let words: Vec<&str> = data.split_whitespace().collect();
    let mut index: HashMap<&str, usize> = HashMap::new();
    for (i, word) in words.iter().enumerate() {
        index.insert(word, i);
    }
    println!("'fox' is at position {}", index["fox"]);
}`,
    seedQuestions: [
      "What does the entry API do differently from a simple insert?",
      "Why does inserting a String key move it into the HashMap?",
      "How does the word frequency counter work step by step?",
      "What would happen if you used scores[\"missing\"] instead of scores.get(\"missing\")?",
    ],
  },

  {
    id: "rust-iterators",
    title: "Iterators",
    difficulty: "Core",
    icon: "🔄",
    description:
      "Iterators in Rust are lazy — they do nothing until consumed. Chaining .map(), .filter(), and .collect() builds a pipeline that runs in a single pass. The Iterator trait requires one method: next(), which returns Option<Item>.",
    concepts: [
      "Iterator trait and .next()",
      "map/filter/collect chain",
      "Lazy evaluation",
      "enumerate and zip",
      "fold and reduce",
    ],
    bridges: {
      "C++":
        "Like C++20 ranges (views::transform, views::filter). Lazy evaluation, composable. Rust iterators compile to the same code as hand-written loops.",
      Python:
        "Like generators and itertools. Python list comprehensions are eager; Rust iterators are lazy until .collect(). Similar to map/filter builtins.",
      Java:
        "Like Stream API (.stream().map().filter().collect()). Very similar mental model — Rust iterators are zero-cost at runtime.",
    },
    code: `fn main() {
    let numbers = vec![1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    // map + filter + collect: lazy chain, single pass
    let even_squares: Vec<i32> = numbers.iter()
        .filter(|&&n| n % 2 == 0)
        .map(|&n| n * n)
        .collect();
    println!("Even squares: {even_squares:?}"); // [4, 16, 36, 64, 100]

    // Lazy: nothing runs until .collect() / .for_each() / etc.
    let _lazy = numbers.iter().map(|n| {
        println!("This never prints!");
        n * 2
    });
    // ^ No output — the iterator was never consumed

    // enumerate: (index, value) pairs
    let names = vec!["Alice", "Bob", "Charlie"];
    for (i, name) in names.iter().enumerate() {
        println!("  {i}: {name}");
    }

    // zip: pair two iterators together
    let scores = vec![92, 87, 95];
    let report: Vec<String> = names.iter()
        .zip(scores.iter())
        .map(|(name, score)| format!("{name}: {score}"))
        .collect();
    println!("{report:?}");

    // fold: accumulate into a single value
    let sum = numbers.iter().fold(0, |acc, &n| acc + n);
    println!("Sum: {sum}");

    // reduce: like fold but uses first element as initial value
    let product = numbers.iter().copied().reduce(|a, b| a * b);
    println!("Product: {:?}", product); // Some(3628800)

    // any, all, find
    let has_even = numbers.iter().any(|&n| n % 2 == 0);
    let all_positive = numbers.iter().all(|&n| n > 0);
    let first_big = numbers.iter().find(|&&n| n > 7);
    println!("has_even={has_even}, all_pos={all_positive}, first_big={first_big:?}");

    // take, skip, chain
    let first_three: Vec<_> = numbers.iter().take(3).collect();
    let skip_five: Vec<_> = numbers.iter().skip(5).collect();
    println!("First 3: {first_three:?}, after 5: {skip_five:?}");

    // sum (shortcut for fold(0, +))
    let total: i32 = numbers.iter().sum();
    println!("Total: {total}");
}`,
    seedQuestions: [
      "What does it mean that iterators are 'lazy' — why doesn't the map closure print anything?",
      "What's the difference between .iter(), .into_iter(), and .iter_mut()?",
      "How is fold different from reduce?",
      "Why does Rust's iterator chain compile to the same performance as a hand-written loop?",
    ],
  },

  {
    id: "rust-closures",
    title: "Closures",
    difficulty: "Core",
    icon: "🎁",
    description:
      "Closures are anonymous functions that capture variables from their surrounding scope. Rust infers how each variable is captured — by reference, mutable reference, or by value. The three closure traits (Fn, FnMut, FnOnce) reflect what the closure does with its captures.",
    concepts: [
      "Closure syntax |args| body",
      "Capturing environment variables",
      "Fn vs FnMut vs FnOnce",
      "Closures as parameters",
      "move closures",
    ],
    bridges: {
      "C++":
        "Like lambdas with capture lists: [&] = by ref, [=] = by copy. Rust infers the capture mode. C++ [var = std::move(var)] is Rust's move ||.",
      Python:
        "Like lambda or nested def. Python closures capture by reference (late binding). Rust captures are analyzed at compile time — no surprises.",
      Java:
        "Like lambdas with functional interfaces (Function<T,R>, Consumer<T>). Java captures must be effectively final; Rust is more flexible with FnMut.",
    },
    code: `fn apply<F: Fn(i32) -> i32>(f: F, val: i32) -> i32 { f(val) }

fn apply_mut<F: FnMut()>(mut f: F, times: usize) {
    for _ in 0..times { f(); }
}

fn make_adder(n: i32) -> impl Fn(i32) -> i32 {
    move |x| x + n // move: take ownership of n
}

fn main() {
    let double = |x| x * 2;
    println!("double(5) = {}", double(5));

    // Captures by reference (Fn — borrows immutably)
    let greeting = String::from("Hello");
    let greet = |name| format!("{greeting}, {name}!");
    println!("{}", greet("Alice"));
    println!("{greeting} still accessible"); // greeting not moved

    // Captures by mutable reference (FnMut)
    let mut count = 0;
    let mut increment = || { count += 1; };
    increment();
    increment();
    println!("Count: {count}"); // 2

    // FnOnce: consumes captured values (can only call once)
    let name = String::from("Alice");
    let consume = move || {
        println!("Consuming: {name}");
        drop(name); // name is owned by the closure
    };
    consume();
    // consume(); // COMPILE ERROR: already consumed

    // Closures as function parameters
    let result = apply(|x| x * x, 7);
    println!("apply square to 7: {result}");

    // FnMut as parameter
    let mut total = 0;
    apply_mut(|| { total += 10; }, 3);
    println!("Total after 3 calls: {total}"); // 30

    // Returning closures with move
    let add5 = make_adder(5);
    let add10 = make_adder(10);
    println!("add5(3)={}, add10(3)={}", add5(3), add10(3));

    // Common pattern: closures with iterators
    let prices = vec![10.0, 25.0, 8.0, 42.0, 15.0];
    let tax_rate = 0.08;
    let with_tax: Vec<f64> = prices.iter()
        .map(|&p| p * (1.0 + tax_rate))
        .filter(|&total| total > 20.0)
        .collect();
    println!("Over $20 after tax: {with_tax:.2?}");
}`,
    seedQuestions: [
      "How does Rust decide whether a closure captures by reference or by value?",
      "What's the difference between Fn, FnMut, and FnOnce?",
      "Why does make_adder need the move keyword?",
      "Why can the consume closure only be called once?",
    ],
  },
] };
