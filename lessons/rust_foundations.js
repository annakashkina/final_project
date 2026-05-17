export const rustFoundations = { name: "Foundations", lessons: [
  {
    id: "rust-hello",
    title: "Hello World & Cargo",
    difficulty: "Beginner",
    icon: "👋",
    description:
      "Your first Rust program. Rust compiles to native machine code — no interpreter, no VM. Cargo is the build tool and package manager (like npm or pip). The println! macro handles formatted output with string interpolation, positional arguments, and debug printing.",
    concepts: [
      "main() entry point",
      "println! macro",
      "String interpolation with {}",
      "Debug printing with {:?}",
      "Cargo basics (cargo new/run/build)",
    ],
    bridges: {
      "C++":
        "println! combines the best of cout (type-safe) and printf (format strings). Cargo replaces CMake/Make.",
      Python:
        "Like print() with f-strings, but println! is a macro (expanded at compile time). Cargo is like pip + venv + build system in one.",
      Java:
        "Replaces System.out.println with format strings built in. Cargo is like Maven/Gradle but standard.",
    },
    code: `fn main() {
    // Basic output
    println!("Hello, world!");

    // String interpolation with variables
    let name = "Rust";
    let year = 2015;
    println!("{name} was released in {year}");

    // Positional arguments
    println!("{0} is fast, {0} is safe, {0} is {1}", "Rust", "fun");

    // Expressions inside {}
    let width = 12;
    let height = 8;
    println!("Area: {} sq units", width * height);

    // Debug printing with {:?} — works on most types
    let languages = ["Rust", "Python", "C++"];
    println!("Languages: {:?}", languages);

    // Pretty-printed debug output
    let scores = vec![(95, "Alice"), (87, "Bob"), (92, "Carol")];
    println!("Scores: {:#?}", scores);

    // Padding and formatting
    println!("Right-aligned: {:>10}", "hello");
    println!("Left-aligned:  {:<10}|", "hello");
    println!("Zero-padded:   {:05}", 42);
    println!("Two decimals:  {:.2}", 3.14159);
}`,
    seedQuestions: [
      "What does the ! in println! mean — why isn't it just a function?",
      "What's the difference between {:?} and {} for printing?",
      "If you run `cargo new my_project`, what files does it create?",
      "Why does Rust use println! instead of a regular print function like Python?",
    ],
  },

  {
    id: "rust-variables",
    title: "Variables & Mutability",
    difficulty: "Beginner",
    icon: "📦",
    description:
      "In Rust, variables are immutable by default — you cannot change them after assignment unless you opt in with `mut`. This prevents accidental mutations and makes code easier to reason about. Shadowing lets you reuse a name by creating a new variable, even with a different type.",
    concepts: [
      "Immutable by default",
      "mut keyword",
      "Shadowing",
      "const vs let",
      "Type inference",
    ],
    bridges: {
      "C++":
        "C++ is mutable by default; you add const to opt in. Rust is the opposite — immutable by default, you add mut to opt in.",
      Python:
        "Python has no concept of const or immutable variables. In Rust, the compiler enforces immutability unless you say mut.",
      Java:
        "Like making every variable final by default, then removing final with mut. Java's final is opt-in; Rust's immutability is opt-out.",
    },
    code: `fn main() {
    // Immutable by default
    let age = 25;
    // age = 26; // COMPILE ERROR: cannot assign twice to immutable variable

    // Opt into mutability with mut
    let mut score = 0;
    score += 10;
    score += 25;
    println!("Score: {score}");

    // Shadowing: rebind the same name (creates a NEW variable)
    let x = 5;
    let x = x + 1;       // shadows previous x
    let x = x * 2;       // shadows again
    println!("x = {x}"); // 12

    // Shadowing can change the type (mut cannot!)
    let spaces = "   ";         // &str
    let spaces = spaces.len();  // now usize
    println!("Spaces: {spaces}");

    // Constants: must have type annotation, known at compile time
    const MAX_CONNECTIONS: u32 = 100;
    const PI: f64 = 3.14159;
    println!("Max: {MAX_CONNECTIONS}, PI: {PI}");

    // Underscores in numeric literals for readability
    let population = 1_000_000;
    let hex_color = 0xFF_AA_00;
    let binary = 0b1111_0000;
    println!("Pop: {population}, Color: {hex_color:#X}, Bits: {binary:#010b}");

    // Type inference: compiler figures out the type
    let temperature = 36.6;    // inferred as f64
    let is_warm = temperature > 30.0;
    println!("Warm? {is_warm}");
}`,
    seedQuestions: [
      "What's the difference between shadowing and using mut — when would you pick each?",
      "Why does shadowing let you change the type but mut does not?",
      "What makes const different from an immutable let binding?",
      "Why does Rust default to immutable — what bugs does this prevent?",
    ],
  },

  {
    id: "rust-types",
    title: "Scalar & Compound Types",
    difficulty: "Beginner",
    icon: "🔢",
    description:
      "Rust is statically typed — every value has a known type at compile time. Scalar types include integers (with guaranteed sizes like i32, u8), floats, booleans, and char (full Unicode). Compound types — tuples and arrays — group multiple values into one.",
    concepts: [
      "Integer types (i32, u8, etc.)",
      "Floating point (f32, f64)",
      "bool and char (Unicode)",
      "Tuples and arrays",
      "Type annotations",
    ],
    bridges: {
      "C++":
        "Similar primitive types, but Rust guarantees sizes (i32 is always 32 bits, unlike C++ int). No implicit conversions between types.",
      Python:
        "Python integers have unlimited size and types are dynamic. Rust integers have fixed sizes and types are checked at compile time.",
      Java:
        "Very similar to Java primitives (int, long, float, double, boolean, char), but Rust's char is 4 bytes (full Unicode) vs Java's 2-byte UTF-16.",
    },
    code: `fn main() {
    // Integer types: i = signed, u = unsigned
    let small: i8 = -128;          // -128 to 127
    let byte: u8 = 255;            // 0 to 255
    let default: i32 = 42;         // most common, the default
    let big: i64 = 9_000_000_000;
    let pointer_sized: usize = 8;  // depends on architecture (32 or 64 bit)
    println!("{small}, {byte}, {default}, {big}, {pointer_sized}");

    // Floating point
    let pi: f64 = 3.14159;    // default float type, 64-bit
    let approx: f32 = 2.718;  // 32-bit, less precision
    println!("pi={pi}, e~={approx}");

    // Boolean and char
    let active: bool = true;
    let letter: char = 'A';
    let emoji: char = '🦀';     // char is 4 bytes — any Unicode scalar value
    println!("{active}, {letter}, {emoji}");

    // Tuples: fixed-size, mixed types
    let person: (&str, u32, f64) = ("Alice", 30, 5.7);
    println!("Name: {}, Age: {}, Height: {}", person.0, person.1, person.2);

    // Destructuring a tuple
    let (name, age, height) = person;
    println!("{name} is {age}, height {height}");

    // Arrays: fixed-size, same type, stack-allocated
    let months: [&str; 4] = ["Jan", "Feb", "Mar", "Apr"];
    println!("First: {}, Last: {}", months[0], months[3]);

    // Initialize array with same value
    let zeros = [0_i32; 5]; // [0, 0, 0, 0, 0]
    println!("Zeros: {:?}", zeros);

    // Type annotations in expressions
    let parsed = "42".parse::<i32>().unwrap();
    let casted = 65u8 as char;
    println!("Parsed: {parsed}, Casted: {casted}");
}`,
    seedQuestions: [
      "What's the difference between i32 and usize — when would you use each?",
      "Why does Rust have both i32 and i64 instead of just one integer type like Python?",
      "What happens if you try to store 256 in a u8?",
      "How are tuples different from arrays — when would you pick one over the other?",
    ],
  },

  {
    id: "rust-functions",
    title: "Functions & Expressions",
    difficulty: "Beginner",
    icon: "⚙️",
    description:
      "Rust functions require type annotations on parameters and return values — the compiler does not infer these. Rust is expression-based: almost everything returns a value, including if blocks and code blocks. The last expression in a function (without a semicolon) is the return value.",
    concepts: [
      "Function definitions with fn",
      "Parameter type annotations",
      "Return types with ->",
      "Expressions vs statements",
      "Implicit return (no semicolon)",
    ],
    bridges: {
      "C++":
        "C++ always needs an explicit `return`. Rust's implicit return (last expression, no semicolon) means less boilerplate in short functions.",
      Python:
        "Python def doesn't require type annotations. Rust's fn requires them for parameters and return types — the compiler enforces correctness.",
      Java:
        "Like Java methods but standalone (no class needed). Return types are after -> instead of before the name.",
    },
    code: `// Parameters must have type annotations
fn greet(name: &str, times: u32) {
    for _ in 0..times {
        println!("Hello, {name}!");
    }
}

// Return type with ->; last expression (no semicolon) is return value
fn add(a: i32, b: i32) -> i32 {
    a + b
}

// if/else is an EXPRESSION — it returns a value
fn classify_temp(celsius: f64) -> &'static str {
    if celsius > 35.0 {
        "hot"
    } else if celsius > 20.0 {
        "comfortable"
    } else {
        "cold"
    }
}

// Early return with explicit return keyword
fn first_even(numbers: &[i32]) -> Option<i32> {
    for &n in numbers {
        if n % 2 == 0 {
            return Some(n);  // explicit return exits early
        }
    }
    None  // implicit return: last expression
}

fn main() {
    greet("World", 2);
    println!("3 + 4 = {}", add(3, 4));
    println!("25°C is {}", classify_temp(25.0));

    // Block expressions: last expression is the block's value
    let area = {
        let w = 5;
        let h = 10;
        w * h  // no semicolon — this is the value
    };
    println!("Area: {area}");

    let nums = [7, 3, 8, 1, 5];
    match first_even(&nums) {
        Some(n) => println!("First even: {n}"),
        None => println!("No even numbers"),
    }
}`,
    seedQuestions: [
      "What happens if you accidentally add a semicolon after `a + b` in the add function?",
      "Why can if/else be used on the right side of a let binding in Rust?",
      "What is the unit type () and when does a function return it?",
      "When would you use an explicit `return` vs an implicit return?",
    ],
  },

  {
    id: "rust-control-flow",
    title: "Control Flow",
    difficulty: "Beginner",
    icon: "🔀",
    description:
      "Rust's control flow constructs are expressions — they return values. `if/else` can be assigned to variables, `loop` can break with a value, and `for` works with ranges and iterators. Labeled loops let you break out of nested loops by name.",
    concepts: [
      "if/else as expressions",
      "loop/while/for",
      "Ranges (.. and ..=)",
      "break with values",
      "Labeled loops",
    ],
    bridges: {
      "C++":
        "C++ if is a statement, not an expression (the ternary ?: is the closest equivalent). Rust has no traditional C-style for(i=0; i<n; i++).",
      Python:
        "Python's for...in is similar to Rust's for...in. But Rust has no while/else or for/else, and loop is a keyword Python lacks.",
      Java:
        "Java's enhanced for is similar to Rust's for. But Java if is a statement — you can't assign its result like in Rust.",
    },
    code: `fn main() {
    // if/else as an expression — assign the result
    let temperature = 28;
    let description = if temperature > 30 {
        "hot"
    } else if temperature > 20 {
        "pleasant"
    } else {
        "cool"
    };
    println!("{temperature}°C is {description}");

    // loop: runs forever until break; can return a value
    let mut counter = 0;
    let result = loop {
        counter += 1;
        if counter == 10 {
            break counter * 2;  // break WITH a value
        }
    };
    println!("Loop result: {result}"); // 20

    // while
    let mut countdown = 5;
    while countdown > 0 {
        print!("{countdown}.. ");
        countdown -= 1;
    }
    println!("Go!");

    // for with exclusive range (..) and inclusive range (..=)
    for i in 0..5 { print!("{i} "); }    // 0 1 2 3 4
    println!();
    for i in 1..=3 { print!("{i} "); }   // 1 2 3
    println!();

    // for over a collection
    let fruits = ["apple", "banana", "cherry"];
    for fruit in &fruits {
        println!("I like {fruit}");
    }

    // Labeled loops: break outer from inner
    let mut found = (0, 0);
    'outer: for row in 0..5 {
        for col in 0..5 {
            if row * 5 + col == 13 {
                found = (row, col);
                break 'outer;  // breaks the outer loop
            }
        }
    }
    println!("Found 13 at row={}, col={}", found.0, found.1);
}`,
    seedQuestions: [
      "Why can `loop` return a value with `break` but `while` cannot?",
      "What's the difference between 0..5 and 0..=5?",
      "How does the 'outer label work — what would happen without it?",
      "Why does iterating over &fruits use a reference instead of consuming the array?",
    ],
  },
] };
