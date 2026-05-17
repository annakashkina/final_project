export const rustAsync = { name: "Async Rust", lessons: [
  {
    id: "rust-async-basics",
    title: "async/await Fundamentals",
    difficulty: "Advanced",
    icon: "⏳",
    description:
      "Rust's async is different from other languages — futures are lazy (nothing happens until polled), and the language doesn't include a runtime. You choose a runtime like tokio. async/await is syntactic sugar over the Future trait. An async fn returns a Future that must be .awaited or spawned on a runtime to execute. This lesson shows the concepts and syntax. To run async code, you need tokio or another runtime (shown in the next lesson). Add to Cargo.toml: tokio = { version = \"1\", features = [\"full\"] }",
    concepts: [
      "async fn returns a Future",
      ".await suspends until ready",
      "Futures are lazy (poll-based)",
      "Runtimes execute futures",
      "async fn composition",
    ],
    bridges: {
      "C++":
        "C++20 coroutines (co_await) are similar but lower-level. Rust's async/await is more ergonomic with the same lazy evaluation model.",
      Python:
        "Python's asyncio uses the same async/await syntax, but Python coroutines start eagerly on creation. Rust futures do nothing until polled.",
      Java:
        "Java's CompletableFuture and virtual threads (Project Loom) serve a similar purpose. Rust futures are zero-cost — no heap allocation for the state machine.",
    },
    code: `use std::time::Duration;

// async fn returns impl Future<Output = T>
// Nothing happens until this future is .awaited
async fn fetch_user(id: u32) -> String {
    // Simulate async work (in real code: HTTP request, DB query, etc.)
    // tokio::time::sleep(Duration::from_millis(100)).await;
    format!("User#{id}")
}

async fn fetch_score(user: &str) -> u32 {
    // tokio::time::sleep(Duration::from_millis(50)).await;
    user.len() as u32 * 10
}

// Composing async functions
async fn get_user_summary(id: u32) -> String {
    let user = fetch_user(id).await;       // suspends here until ready
    let score = fetch_score(&user).await;  // then suspends here
    format!("{user} (score: {score})")
}

// Async functions can return Result
async fn fetch_data(url: &str) -> Result<String, String> {
    if url.starts_with("https") {
        Ok(format!("Data from {url}"))
    } else {
        Err("Only HTTPS supported".to_string())
    }
}

// What the compiler roughly generates (conceptual):
// async fn fetch_user(id: u32) -> String
// becomes a state machine implementing Future<Output = String>
// enum FetchUserFuture { Start(u32), Waiting, Done }
// impl Future for FetchUserFuture { fn poll(...) -> Poll<String> }

#[tokio::main] // expands to: fn main() { tokio::runtime::Runtime::new().block_on(async_main()) }
async fn main() {
    // .await drives the future to completion
    let summary = get_user_summary(42).await;
    println!("{summary}");

    // Error handling with async
    match fetch_data("https://api.example.com").await {
        Ok(data) => println!("{data}"),
        Err(e) => eprintln!("Error: {e}"),
    }

    // This does NOTHING (future created but never polled):
    let _unused = fetch_user(99);  // warning: unused future
}`,
    seedQuestions: [
      "What happens if you call an async function but never .await it?",
      "Why does Rust require an external runtime like tokio instead of building one into the language?",
      "How is a Rust Future different from a JavaScript Promise?",
      "What does the compiler turn an async function into under the hood?",
    ],
  },

  {
    id: "rust-async-runtime",
    title: "Async Runtimes",
    difficulty: "Advanced",
    icon: "🏃",
    description:
      "Rust's async needs a runtime to execute futures. tokio is the most widely used runtime — it provides a multi-threaded scheduler, timers, I/O, and task spawning. #[tokio::main] sets up the runtime for you. tokio::spawn creates concurrent tasks (like lightweight threads). Add to Cargo.toml: tokio = { version = \"1\", features = [\"full\"] }",
    concepts: [
      "tokio runtime",
      "#[tokio::main] macro",
      "tokio::spawn for tasks",
      "JoinHandle for task results",
      "Bridging sync and async",
    ],
    bridges: {
      "C++":
        "Like boost::asio or custom event loops. C++ has no standard async runtime — you pick one, same as Rust.",
      Python:
        "Like asyncio.run() creating the event loop. tokio::spawn is like asyncio.create_task(). The concept maps closely.",
      Java:
        "Like ExecutorService managing thread pools. tokio tasks are lighter than Java threads but similar to virtual threads (Loom).",
    },
    code: `use tokio::time::{sleep, Duration};

async fn download(url: &str) -> String {
    println!("Starting download: {url}");
    sleep(Duration::from_millis(100)).await; // simulate network delay
    format!("Content of {url}")
}

async fn process(data: String) -> usize {
    sleep(Duration::from_millis(50)).await;
    println!("Processed: {} bytes", data.len());
    data.len()
}

#[tokio::main]
async fn main() {
    // --- Sequential: one after another ---
    let page = download("https://example.com").await;
    let size = process(page).await;
    println!("Sequential result: {size} bytes");

    // --- Concurrent: spawn independent tasks ---
    let task1 = tokio::spawn(async {
        download("https://api.example.com/users").await
    });
    let task2 = tokio::spawn(async {
        download("https://api.example.com/posts").await
    });

    // JoinHandle: await the result of a spawned task
    let result1 = task1.await.expect("task1 panicked");
    let result2 = task2.await.expect("task2 panicked");
    println!("Got: {result1} and {result2}");

    // --- Spawn many tasks ---
    let mut handles = vec![];
    for i in 0..5 {
        handles.push(tokio::spawn(async move {
            sleep(Duration::from_millis(10 * i)).await;
            i * i
        }));
    }

    let mut results = vec![];
    for handle in handles {
        results.push(handle.await.unwrap());
    }
    println!("Squares: {results:?}");
}

// Bridging sync and async (when you can't use #[tokio::main]):
// fn sync_function() {
//     let rt = tokio::runtime::Runtime::new().unwrap();
//     let result = rt.block_on(async {
//         download("https://example.com").await
//     });
//     println!("From sync: {result}");
// }`,
    seedQuestions: [
      "What is the difference between calling download().await and tokio::spawn(download())?",
      "Why does tokio::spawn require the future to be 'static (own all its data)?",
      "What happens if a spawned task panics — does it crash the whole program?",
      "When would you use block_on instead of #[tokio::main]?",
    ],
  },

  {
    id: "rust-async-patterns",
    title: "Async Patterns",
    difficulty: "Advanced",
    icon: "🔀",
    description:
      "Common patterns for coordinating async work in tokio: select! races multiple futures (first one wins), join! waits for all concurrently, mpsc channels pass messages between tasks, and async Mutex protects shared state. These compose to build complex concurrent systems. Add to Cargo.toml: tokio = { version = \"1\", features = [\"full\"] }",
    concepts: [
      "select! for racing futures",
      "join! for concurrent awaiting",
      "Async channels",
      "Async Mutex",
      "Error handling in async code",
    ],
    bridges: {
      "C++":
        "Like when_any/when_all proposals. Boost.Asio has similar patterns. No standard equivalent yet.",
      Python:
        "asyncio.gather() is like join!, asyncio.wait(return_when=FIRST_COMPLETED) is like select!. Very similar concepts.",
      Java:
        "CompletableFuture.anyOf() is like select!, allOf() is like join!. Java's BlockingQueue maps to async channels.",
    },
    code: `use tokio::sync::{mpsc, Mutex};
use tokio::time::{sleep, Duration, timeout};
use std::sync::Arc;

async fn fast_api() -> String {
    sleep(Duration::from_millis(50)).await;
    "fast response".to_string()
}

async fn slow_api() -> String {
    sleep(Duration::from_millis(200)).await;
    "slow response".to_string()
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // --- select!: race futures, first one wins ---
    tokio::select! {
        result = fast_api() => println!("Fast won: {result}"),
        result = slow_api() => println!("Slow won: {result}"),
    }

    // --- join!: run all concurrently, wait for all ---
    let (a, b) = tokio::join!(fast_api(), slow_api());
    println!("Both done: {a}, {b}");

    // --- timeout: cancel if too slow ---
    match timeout(Duration::from_millis(100), slow_api()).await {
        Ok(result) => println!("Got: {result}"),
        Err(_) => println!("Timed out!"),
    }

    // --- Channels: send messages between tasks ---
    let (tx, mut rx) = mpsc::channel::<String>(32);
    let tx2 = tx.clone();

    tokio::spawn(async move {
        tx.send("from task 1".into()).await.unwrap();
    });
    tokio::spawn(async move {
        tx2.send("from task 2".into()).await.unwrap();
    });

    while let Some(msg) = rx.recv().await {
        println!("Received: {msg}");
    }

    // --- Async Mutex: shared state across tasks ---
    let counter = Arc::new(Mutex::new(0u32));
    let mut handles = vec![];

    for _ in 0..5 {
        let counter = Arc::clone(&counter);
        handles.push(tokio::spawn(async move {
            let mut lock = counter.lock().await; // async lock
            *lock += 1;
        }));
    }
    for h in handles { h.await?; }
    println!("Counter: {}", *counter.lock().await);

    Ok(())
}`,
    seedQuestions: [
      "What happens to the losing future in select! — is it cancelled or does it keep running?",
      "When would you use tokio::sync::Mutex instead of std::sync::Mutex in async code?",
      "Why does the mpsc channel need a buffer size (32 in this example)?",
      "How does the ? operator work with async functions that return Result?",
    ],
  },
] };
