export const rustTypes = { name: "Structs & Enums", lessons: [
  {
    id: "rust-structs",
    title: "Structs & Methods",
    difficulty: "Core",
    icon: "🏗️",
    description:
      "In Rust, structs are the primary way to create custom types. Unlike classes in other languages, structs don't have inheritance — behavior is added through impl blocks. You define fields, then attach methods and associated functions in separate impl blocks.",
    concepts: [
      "Struct definition and instantiation",
      "Methods with &self",
      "Associated functions (no self)",
      "Struct update syntax (..)",
      "Self type alias",
    ],
    bridges: {
      "C++":
        "Like classes with public fields. impl blocks are like defining member functions outside the class. No constructors — use associated functions instead.",
      Python:
        "Like @dataclass but with explicit types. Methods take &self instead of self. Associated functions are like @staticmethod.",
      Java:
        "Like a class with fields + methods, but no inheritance, no constructors. Associated functions are like static methods.",
    },
    code: `struct BankAccount {
    owner: String,
    balance: f64,
    frozen: bool,
}

impl BankAccount {
    // Associated function (no self) — like a constructor
    fn new(owner: &str, initial: f64) -> Self {
        Self { owner: owner.to_string(), balance: initial, frozen: false }
    }

    // Method: borrows self immutably
    fn summary(&self) -> String {
        format!("{}: \${:.2}{}", self.owner, self.balance,
                if self.frozen { " [FROZEN]" } else { "" })
    }

    // Method: borrows self mutably
    fn deposit(&mut self, amount: f64) {
        if !self.frozen && amount > 0.0 {
            self.balance += amount;
        }
    }

    // Method: takes ownership of self (consumes the account)
    fn close(self) -> f64 {
        println!("Closing account for {}", self.owner);
        self.balance // account is consumed, can't use it after this
    }
}

fn main() {
    let mut acct = BankAccount::new("Alice", 100.0);
    acct.deposit(50.0);
    println!("{}", acct.summary()); // Alice: $150.00

    // Struct update syntax: copy fields from another instance
    let acct2 = BankAccount { owner: "Bob".to_string(), ..acct };
    println!("{}", acct2.summary()); // Bob: $150.00

    let final_balance = acct2.close();
    println!("Returned: \${final_balance:.2}");
    // acct2 is consumed — can't use it here
}`,
    seedQuestions: [
      "What's the difference between &self, &mut self, and self as method parameters?",
      "Why is BankAccount::new called an 'associated function' instead of a 'constructor'?",
      "What does the .. in struct update syntax do, and what happens to the original?",
      "After calling acct2.close(), why can't we use acct2 anymore?",
    ],
  },

  {
    id: "rust-enums",
    title: "Enums & Option",
    difficulty: "Core",
    icon: "🎯",
    description:
      "Rust has no null. Instead, Option<T> represents values that might not exist, and the compiler forces you to handle both cases. Rust enums can carry data in each variant, making them far more powerful than enums in most languages.",
    concepts: [
      "Enums with data variants",
      "Option<T> instead of null",
      "match with enums",
      "if let for single variants",
      "Methods on enums",
    ],
    bridges: {
      "C++":
        "Like std::variant + std::optional combined. Rust enums are type-safe tagged unions with exhaustive matching.",
      Python:
        "Python has None with no compiler safety. Rust's Option<T> forces you to check — no AttributeError at runtime.",
      Java:
        "Like Optional<T> and sealed classes (Java 17+). But Rust enforces handling at compile time, not with runtime exceptions.",
    },
    code: `enum Command {
    Quit,
    Echo(String),
    Move { x: i32, y: i32 },
    Color(u8, u8, u8),
}

impl Command {
    fn execute(&self) {
        match self {
            Command::Quit => println!("Quitting"),
            Command::Echo(msg) => println!("Echo: {msg}"),
            Command::Move { x, y } => println!("Moving to ({x}, {y})"),
            Command::Color(r, g, b) => println!("Color: #{r:02x}{g:02x}{b:02x}"),
        }
    }
}

// Option<T>: Rust's replacement for null
fn find_user(id: u32) -> Option<String> {
    match id {
        1 => Some("Alice".to_string()),
        2 => Some("Bob".to_string()),
        _ => None,
    }
}

fn main() {
    let cmds = vec![
        Command::Echo("hello".to_string()),
        Command::Move { x: 10, y: 20 },
        Command::Color(255, 128, 0),
        Command::Quit,
    ];
    for cmd in &cmds {
        cmd.execute();
    }

    // Option: must handle both Some and None
    let user = find_user(1);
    match &user {
        Some(name) => println!("Found: {name}"),
        None => println!("Not found"),
    }

    // if let: when you only care about one variant
    if let Some(name) = find_user(2) {
        println!("User 2: {name}");
    }

    // Chaining: map, unwrap_or, and_then
    let greeting = find_user(99)
        .map(|name| format!("Hello, {name}!"))
        .unwrap_or("Guest".to_string());
    println!("{greeting}");
}`,
    seedQuestions: [
      "How is Option<T> different from using null in other languages?",
      "What happens if you forget a variant in a match expression?",
      "When would you use if let instead of a full match?",
      "Can enum variants hold different types of data? Show examples from this code.",
    ],
  },

  {
    id: "rust-pattern-matching",
    title: "Pattern Matching",
    difficulty: "Core",
    icon: "🎭",
    description:
      "Rust's match is an expression that must handle every possible case. You can destructure structs and enums, add guard conditions, bind values with @, and combine patterns with |. The compiler ensures you never miss a case.",
    concepts: [
      "Exhaustive matching",
      "Destructuring in patterns",
      "Match guards (if)",
      "Wildcard _ and ..",
      "Binding with @",
    ],
    bridges: {
      "C++":
        "C++ structured bindings + std::visit for variants, but not exhaustive. C++ switch doesn't destructure or guarantee coverage.",
      Python:
        "Python 3.10+ match/case is similar but not exhaustive — the compiler won't warn you about missing cases.",
      Java:
        "Java switch expressions (14+) have some exhaustiveness, but can't destructure or bind inner values like Rust.",
    },
    code: `struct Point { x: f64, y: f64 }

enum Shape {
    Circle(f64),
    Rect { w: f64, h: f64 },
    Triangle(Point, Point, Point),
}

fn classify(shape: &Shape) -> String {
    match shape {
        Shape::Circle(r) if *r > 100.0 => "huge circle".to_string(),
        Shape::Circle(r) => format!("circle r={r}"),
        Shape::Rect { w, h } if (w - h).abs() < f64::EPSILON => {
            format!("square side={w}")
        }
        Shape::Rect { w, h } => format!("rect {w}x{h}"),
        // Destructure nested structs, ignore remaining fields with ..
        Shape::Triangle(Point { x, y }, ..) => {
            format!("triangle at ({x}, {y})")
        }
    }
}

fn describe_code(code: u16) -> &'static str {
    match code {
        200 => "OK",
        301 | 302 => "redirect",           // multiple values with |
        400 => "bad request",
        404 => "not found",
        n @ 500..=599 => {                 // bind + range pattern
            if n == 503 { "unavailable" } else { "server error" }
        }
        _ => "unknown",                    // wildcard catches the rest
    }
}

fn main() {
    let shapes = vec![
        Shape::Circle(5.0),
        Shape::Circle(200.0),
        Shape::Rect { w: 4.0, h: 4.0 },
        Shape::Rect { w: 3.0, h: 7.0 },
        Shape::Triangle(
            Point { x: 0.0, y: 0.0 },
            Point { x: 1.0, y: 0.0 },
            Point { x: 0.0, y: 1.0 },
        ),
    ];
    for s in &shapes {
        println!("{}", classify(s));
    }

    // match is an expression — returns a value
    let status = 302u16;
    let msg = match status { 200 => "success", _ => describe_code(status) };
    println!("{status}: {msg}");
}`,
    seedQuestions: [
      "What does exhaustive matching mean and why does Rust require it?",
      "How does the @ binding work in the 500..=599 pattern?",
      "What's the difference between _ and .. in patterns?",
      "Why can match be used as an expression — what advantage does that give?",
    ],
  },

  {
    id: "rust-tuples-arrays",
    title: "Tuples, Arrays & Destructuring",
    difficulty: "Beginner",
    icon: "📐",
    description:
      "Tuples group values of different types, arrays hold values of the same type with a fixed size. Both are stack-allocated and support destructuring. The unit type () is Rust's way of saying 'nothing meaningful to return'.",
    concepts: [
      "Tuple creation and destructuring",
      "Unit type ()",
      "Fixed-size arrays [T; N]",
      "Array indexing and iteration",
      "Stack allocation for arrays",
    ],
    bridges: {
      "C++":
        "std::tuple for tuples (accessed with std::get<0>), std::array<T,N> for fixed arrays. Same stack allocation, more verbose.",
      Python:
        "Python tuples are similar but dynamically typed. Python lists are heap-allocated and growable — Rust arrays are fixed and on the stack.",
      Java:
        "Java has no tuples (you'd make a class). Java arrays are heap-allocated objects. Rust arrays are stack values with no overhead.",
    },
    code: `fn divide(a: f64, b: f64) -> (f64, f64) {
    // Return a tuple: (quotient, remainder)
    (a / b, a % b)
}

fn first_and_last(items: &[i32]) -> Option<(i32, i32)> {
    if items.is_empty() {
        None
    } else {
        Some((items[0], items[items.len() - 1]))
    }
}

fn log_event(msg: &str) -> () {
    // -> () is the unit type, usually omitted
    println!("[LOG] {msg}");
}

fn main() {
    // Tuple: fixed-size, mixed types, accessed with .0 .1 .2
    let point = (3.0, 4.0, "origin");
    println!("x={}, y={}, label={}", point.0, point.1, point.2);

    // Destructuring a tuple
    let (quotient, remainder) = divide(17.0, 5.0);
    println!("17 / 5 = {quotient} remainder {remainder}");

    // Nested destructuring with Option
    if let Some((first, last)) = first_and_last(&[10, 20, 30, 40]) {
        println!("first={first}, last={last}");
    }

    // Unit type: functions that return nothing return ()
    let _result: () = log_event("started");

    // Arrays: fixed size, same type, stack-allocated
    let temps: [f64; 5] = [20.1, 21.3, 19.8, 22.5, 20.9];
    println!("Day 1: {}C", temps[0]);
    println!("Days recorded: {}", temps.len());

    // Initialize all elements to the same value
    let zeros = [0u8; 1024]; // 1024 bytes on the stack, no heap
    println!("Buffer size: {} bytes", zeros.len());

    // Iterate with index
    for (i, temp) in temps.iter().enumerate() {
        println!("  Day {}: {temp:.1}C", i + 1);
    }

    // Array methods
    let max = temps.iter().cloned().reduce(f64::max);
    println!("Highest: {:.1}C", max.unwrap());

    // Slices: borrow part of an array
    let weekend = &temps[3..5];
    println!("Weekend temps: {weekend:?}");
}`,
    seedQuestions: [
      "What's the difference between a tuple and an array in Rust?",
      "Why does Rust have a unit type () — when is it useful?",
      "How are arrays different from Vec<T> in terms of memory?",
      "What does [0u8; 1024] create and where does it live in memory?",
    ],
  },
] };
