export const rustFunctional = { name: "Functional Patterns", lessons: [
  {
    id: "rust-higher-order",
    title: "Higher-Order Functions",
    difficulty: "Intermediate",
    icon: "🎵",
    description:
      "Functions that take other functions as parameters or return them. Rust distinguishes between function pointers (fn) and closures (Fn traits), giving you precise control over how behavior is composed.",
    concepts: [
      "Functions as parameters",
      "Function pointers (fn type)",
      "Fn trait family as parameters",
      "Returning functions",
      "Composing behavior",
    ],
    bridges: {
      "C++":
        "Like std::function and function pointers, but Rust's Fn/FnMut/FnOnce traits tell you exactly how the closure captures — no hidden copies.",
      Python:
        "Python functions are first-class too. Rust adds type safety: you declare exactly what signature you accept, checked at compile time.",
      Java: "Like functional interfaces (Predicate, Function) and method references, but without the single-abstract-method boilerplate.",
    },
    code: `fn apply_twice(f: fn(i32) -> i32, x: i32) -> i32 {
    f(f(x))
}

fn double(x: i32) -> i32 { x * 2 }

// Accept any callable, not just function pointers
fn transform_all(data: &[f64], f: impl Fn(f64) -> f64) -> Vec<f64> {
    data.iter().map(|&x| f(x)).collect()
}

// Return a closure (must use impl Fn because closures have unique types)
fn make_multiplier(factor: f64) -> impl Fn(f64) -> f64 {
    move |x| x * factor
}

// Pipeline: chain transformations
fn pipeline(input: f64, steps: &[&dyn Fn(f64) -> f64]) -> f64 {
    steps.iter().fold(input, |acc, f| f(acc))
}

fn main() {
    // Function pointer: pass a named function directly
    println!("apply_twice(double, 3) = {}", apply_twice(double, 3));

    // Closure: captures nothing, compatible with fn pointer
    let square = |x: i32| x * x;
    println!("apply_twice(square, 3) = {}", apply_twice(square, 3));

    // Closure that captures environment (needs Fn trait, not fn pointer)
    let readings = vec![20.0, 21.5, 19.8, 22.1];
    let offset = 1.5;
    let calibrated = transform_all(&readings, |x| x + offset);
    println!("Calibrated: {calibrated:?}");

    // Returned closure
    let triple = make_multiplier(3.0);
    let scaled = transform_all(&readings, triple);
    println!("Tripled: {scaled:?}");

    // Pipeline: compose multiple steps
    let add_ten: &dyn Fn(f64) -> f64 = &|x| x + 10.0;
    let halve: &dyn Fn(f64) -> f64 = &|x| x / 2.0;
    let result = pipeline(100.0, &[add_ten, halve]);
    println!("pipeline(100): {result}"); // (100+10)/2 = 55
}`,
    seedQuestions: [
      "What's the difference between `fn(i32) -> i32` and `impl Fn(i32) -> i32` as a parameter type?",
      "Why does make_multiplier need the `move` keyword in its closure?",
      "Why can the `square` closure be passed where a `fn` pointer is expected, but the closure with `offset` cannot?",
      "How does the pipeline function use fold to chain transformations?",
    ],
  },

  {
    id: "rust-custom-iterators",
    title: "Custom Iterators",
    difficulty: "Advanced",
    icon: "🔄",
    description:
      "The Iterator trait requires just one method: next(). Implement it to make any type iterable, composable with map/filter/take, and usable in for loops via IntoIterator.",
    concepts: [
      "Iterator trait (Item + next())",
      "Building custom iterators",
      "IntoIterator for for-loop support",
      "Composing with standard adapters",
      "State machine iterators",
    ],
    bridges: {
      "C++":
        "Like writing a custom iterator class with begin/end and operator++, but far less boilerplate — just implement next().",
      Python:
        "Very similar to __iter__ and __next__. Rust's Iterator trait is the same idea, but typed and zero-cost.",
      Java: "Like implementing Iterator<T> with hasNext/next, but Rust combines both checks into a single next() returning Option.",
    },
    code: `struct Fibonacci {
    a: u64,
    b: u64,
}

impl Fibonacci {
    fn new() -> Self {
        Fibonacci { a: 0, b: 1 }
    }
}

impl Iterator for Fibonacci {
    type Item = u64;

    fn next(&mut self) -> Option<Self::Item> {
        let current = self.a;
        self.a = self.b;
        self.b = current + self.b;
        Some(current)
    }
}

// A bounded range iterator that produces multiples
struct Multiples {
    factor: u32,
    current: u32,
    limit: u32,
}

impl Multiples {
    fn of(factor: u32) -> Self {
        Multiples { factor, current: 0, limit: u32::MAX }
    }
    fn up_to(mut self, limit: u32) -> Self {
        self.limit = limit;
        self
    }
}

impl Iterator for Multiples {
    type Item = u32;

    fn next(&mut self) -> Option<Self::Item> {
        self.current += self.factor;
        if self.current > self.limit { None } else { Some(self.current) }
    }
}

fn main() {
    // Fibonacci: infinite iterator, use take() to limit
    let fibs: Vec<u64> = Fibonacci::new().take(10).collect();
    println!("First 10 fibs: {fibs:?}");

    // Compose with standard adapters
    let even_fibs: Vec<u64> = Fibonacci::new()
        .filter(|n| n % 2 == 0)
        .take(5)
        .collect();
    println!("First 5 even fibs: {even_fibs:?}");

    let sum: u64 = Fibonacci::new().take_while(|&n| n < 100).sum();
    println!("Sum of fibs < 100: {sum}");

    // Custom bounded iterator
    let threes: Vec<u32> = Multiples::of(3).up_to(20).collect();
    println!("Multiples of 3 up to 20: {threes:?}");

    // for loop works because Iterator implies IntoIterator
    for n in Multiples::of(7).up_to(50) {
        print!("{n} ");
    }
    println!();
}`,
    seedQuestions: [
      "Why does Fibonacci::next() return Option<u64> instead of just u64?",
      "What would happen if you called `collect()` on Fibonacci without `take()` first?",
      "How does the for loop work with Multiples — what trait makes that possible?",
      "Why can we chain .filter().take().collect() on our custom iterator without writing any extra code?",
    ],
  },

  {
    id: "rust-builder",
    title: "Builder Pattern",
    difficulty: "Advanced",
    icon: "🏗️",
    description:
      "Rust has no function overloading or default arguments, so the builder pattern is the idiomatic way to construct complex objects. A builder struct accumulates configuration through method chaining, then validates and produces the final value in build().",
    concepts: [
      "Builder struct pattern",
      "Method chaining with self",
      "Optional fields with Option<T>",
      "Validation in build()",
      "Why Rust favors builders",
    ],
    bridges: {
      "C++":
        "C++ has overloading and default args, so builders are less common. In Rust, builders fill that gap cleanly.",
      Python:
        "Python's keyword arguments and **kwargs make builders mostly unnecessary. Rust needs them because there are no named/default args.",
      Java: "Java uses builders heavily too (StringBuilder, HttpClient.Builder). Same pattern, Rust just makes it even more necessary.",
    },
    code: `#[derive(Debug)]
struct HttpRequest {
    method: String,
    url: String,
    headers: Vec<(String, String)>,
    body: Option<String>,
    timeout_ms: u64,
}

#[derive(Default)]
struct RequestBuilder {
    method: Option<String>,
    url: Option<String>,
    headers: Vec<(String, String)>,
    body: Option<String>,
    timeout_ms: Option<u64>,
}

impl RequestBuilder {
    fn new() -> Self {
        Self::default()
    }

    fn method(mut self, method: &str) -> Self {
        self.method = Some(method.to_string());
        self
    }

    fn url(mut self, url: &str) -> Self {
        self.url = Some(url.to_string());
        self
    }

    fn header(mut self, key: &str, value: &str) -> Self {
        self.headers.push((key.to_string(), value.to_string()));
        self
    }

    fn body(mut self, body: &str) -> Self {
        self.body = Some(body.to_string());
        self
    }

    fn timeout(mut self, ms: u64) -> Self {
        self.timeout_ms = Some(ms);
        self
    }

    fn build(self) -> Result<HttpRequest, String> {
        let url = self.url.ok_or("URL is required")?;
        let method = self.method.unwrap_or_else(|| "GET".to_string());

        if method == "POST" && self.body.is_none() {
            return Err("POST requests require a body".to_string());
        }

        Ok(HttpRequest {
            method,
            url,
            headers: self.headers,
            body: self.body,
            timeout_ms: self.timeout_ms.unwrap_or(5000),
        })
    }
}

fn main() {
    let req = RequestBuilder::new()
        .url("https://api.example.com/users")
        .header("Accept", "application/json")
        .timeout(3000)
        .build()
        .unwrap();
    println!("{req:#?}");

    let post = RequestBuilder::new()
        .method("POST")
        .url("https://api.example.com/users")
        .header("Content-Type", "application/json")
        .body(r#"{"name": "Alice"}"#)
        .build()
        .unwrap();
    println!("{post:#?}");

    // Validation catches missing body for POST
    let err = RequestBuilder::new()
        .method("POST")
        .url("https://api.example.com/data")
        .build();
    println!("Error: {}", err.unwrap_err());
}`,
    seedQuestions: [
      "Why does each builder method take `self` by value and return `Self` instead of using `&mut self`?",
      "Why does Rust need the builder pattern when C++ and Python often don't?",
      "How does build() use Option to distinguish between 'not set' and 'set to a value'?",
      "What would happen if you tried to use the builder after calling build()?",
    ],
  },
] };
