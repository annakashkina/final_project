export const rustConcurrency = { name: "Concurrency", lessons: [
  {
    id: "rust-threads",
    title: "Threads & JoinHandles",
    difficulty: "Advanced",
    icon: "🧵",
    description:
      "Rust's ownership system prevents data races at compile time. The compiler ensures you can't accidentally share mutable data between threads — this is called 'fearless concurrency.' You spawn threads with thread::spawn, which returns a JoinHandle. The handle lets you wait for the thread to finish and get its return value. Use a move closure to transfer ownership of data into the thread.",
    concepts: [
      "thread::spawn and JoinHandle",
      "move closures for threads",
      "Joining threads",
      "Returning values from threads",
      "Compiler prevents data races",
    ],
    bridges: {
      "C++":
        "Like std::thread with .join(), but Rust's compiler rejects code that would cause data races. C++ leaves that to you.",
      Python:
        "Like threading.Thread, but Python's GIL limits true parallelism. Rust threads run in parallel with compile-time safety.",
      Java:
        "Like Thread + Runnable. Java relies on synchronized/volatile for safety; Rust enforces it at compile time.",
    },
    code: `use std::thread;
use std::time::Duration;

fn main() {
    // Basic thread: move ownership of data in
    let names = vec!["Alice", "Bob", "Charlie"];
    let handle = thread::spawn(move || {
        for name in &names {
            println!("Hello, {name}!");
            thread::sleep(Duration::from_millis(50));
        }
        names.len() // return a value from the thread
    });
    // println!("{names:?}"); // COMPILE ERROR: names moved into thread

    // join() returns Result<T> — the thread's return value
    let count = handle.join().unwrap();
    println!("Greeted {count} people");

    // Multiple threads computing in parallel
    let mut handles = vec![];
    for i in 0..4 {
        handles.push(thread::spawn(move || {
            let result = (i + 1) * 10;
            println!("Thread {i} computed {result}");
            result
        }));
    }

    let total: i32 = handles
        .into_iter()
        .map(|h| h.join().unwrap())
        .sum();
    println!("Total: {total}");

    // The compiler prevents using data after moving it to a thread
    let data = String::from("important");
    let h = thread::spawn(move || {
        println!("Thread owns: {data}");
    });
    // println!("{data}"); // COMPILE ERROR: value used after move
    h.join().unwrap();

    // Without move, compiler rejects: closure may outlive current function
    // let local = String::from("local");
    // thread::spawn(|| println!("{local}")); // ERROR: borrowed value doesn't live long enough
}`,
    seedQuestions: [
      "Why does thread::spawn require a move closure when using local variables?",
      "What does join() return, and what happens if the spawned thread panics?",
      "Why can't we use `names` after passing it to the thread with move?",
      "How is Rust's approach to thread safety different from C++ or Java?",
    ],
  },

  {
    id: "rust-channels",
    title: "Message Passing",
    difficulty: "Advanced",
    icon: "📬",
    description:
      "Channels let threads communicate by sending values. Rust's mpsc::channel() creates a multi-producer, single-consumer channel. The sender (tx) transfers ownership of values to the receiver (rx) — once sent, the sending thread can no longer use that value. You can clone the transmitter for multiple producers. The receiver can be iterated like a collection, blocking until all senders are dropped.",
    concepts: [
      "mpsc channel (multi-producer single-consumer)",
      "send() and recv()",
      "Iterating over receiver",
      "Cloning transmitter for multiple producers",
      "Ownership transfer through channels",
    ],
    bridges: {
      "C++":
        "No built-in channels. You'd use a thread-safe queue (e.g., Boost lockfree queue). Rust's channels handle synchronization for you.",
      Python:
        "Like queue.Queue for threading. But Rust's channels transfer ownership, so no two threads can access the same data.",
      Java:
        "Like BlockingQueue. But Rust enforces at compile time that sent data can't be used by the sender anymore.",
    },
    code: `use std::sync::mpsc;
use std::thread;
use std::time::Duration;

fn main() {
    // Basic channel: send values between threads
    let (tx, rx) = mpsc::channel();

    thread::spawn(move || {
        let tasks = vec!["parse", "validate", "transform"];
        for task in tasks {
            tx.send(format!("completed: {task}")).unwrap();
            thread::sleep(Duration::from_millis(100));
        }
        // tx drops here -> receiver knows no more messages
    });

    // Iterate over receiver: blocks until channel closes
    for msg in rx {
        println!("Main received: {msg}");
    }

    // Multiple producers: clone the transmitter
    let (tx, rx) = mpsc::channel();

    for worker_id in 0..3 {
        let tx = tx.clone();
        thread::spawn(move || {
            let result = worker_id * worker_id;
            tx.send((worker_id, result)).unwrap();
        });
    }
    drop(tx); // drop original so rx iterator can finish

    let mut results: Vec<_> = rx.into_iter().collect();
    results.sort_by_key(|(id, _)| *id);
    for (id, result) in &results {
        println!("Worker {id}: {result}");
    }

    // Ownership transfer: sent values can't be used afterward
    let (tx, rx) = mpsc::channel();
    let data = String::from("sensitive payload");
    tx.send(data).unwrap();
    // println!("{data}"); // COMPILE ERROR: value moved by send()
    println!("Received: {}", rx.recv().unwrap());

    // recv() vs try_recv()
    let (tx, rx) = mpsc::channel::<String>();
    match rx.try_recv() {
        Ok(msg) => println!("Got: {msg}"),
        Err(mpsc::TryRecvError::Empty) => println!("Nothing yet"),
        Err(mpsc::TryRecvError::Disconnected) => println!("Channel closed"),
    }
    drop(tx);
}`,
    seedQuestions: [
      "Why do we need to drop(tx) after cloning it to workers?",
      "What happens if a thread tries to send on a channel whose receiver has been dropped?",
      "How does ownership transfer through the channel prevent data races?",
      "When would you use try_recv() instead of recv()?",
    ],
  },

  {
    id: "rust-shared-state",
    title: "Shared State with Mutex",
    difficulty: "Advanced",
    icon: "🔐",
    description:
      "When multiple threads need to read and write the same data, use Mutex<T> for mutual exclusion. Calling .lock() returns a MutexGuard that auto-unlocks when dropped (RAII pattern). To share a Mutex across threads, wrap it in Arc<T>. Arc<Mutex<T>> is the standard pattern for shared mutable state across threads. Watch out for deadlocks — if a thread panics while holding a lock, the Mutex becomes 'poisoned.'",
    concepts: [
      "Mutex<T> for thread-safe mutation",
      "MutexGuard and RAII locking",
      "Arc<Mutex<T>> pattern",
      "Lock poisoning",
      "Mutex vs channels trade-offs",
    ],
    bridges: {
      "C++":
        "Like std::mutex with std::lock_guard for RAII. But Rust won't let you access the data without holding the lock — the type system enforces it.",
      Python:
        "Like threading.Lock(), but Rust's Mutex wraps the data itself. You literally cannot access the data without locking.",
      Java:
        "Like synchronized blocks or ReentrantLock. Rust's Mutex owns the data, so forgetting to lock is a compile error, not a bug.",
    },
    code: `use std::sync::{Arc, Mutex};
use std::thread;

fn main() {
    // Basic Mutex: lock() returns a guard that auto-unlocks
    let data = Mutex::new(vec![1, 2, 3]);
    {
        let mut guard = data.lock().unwrap();
        guard.push(4);
        println!("Inside lock: {:?}", *guard);
    } // guard dropped -> lock released
    println!("After unlock: {:?}", data.lock().unwrap());

    // Arc<Mutex<T>>: shared mutable state across threads
    let counter = Arc::new(Mutex::new(0));
    let mut handles = vec![];

    for _ in 0..10 {
        let counter = Arc::clone(&counter);
        handles.push(thread::spawn(move || {
            *counter.lock().unwrap() += 1;
        }));
    }
    for h in handles { h.join().unwrap(); }
    println!("Counter: {}", *counter.lock().unwrap());

    // Shared work log across threads
    let log = Arc::new(Mutex::new(Vec::new()));
    let mut handles = vec![];
    for id in 0..4 {
        let log = Arc::clone(&log);
        handles.push(thread::spawn(move || {
            log.lock().unwrap().push(format!("worker-{id} done"));
        }));
    }
    for h in handles { h.join().unwrap(); }
    println!("Log: {:?}", *log.lock().unwrap());

    // Lock poisoning: thread panics while holding the lock
    let data = Arc::new(Mutex::new(42));
    let data2 = Arc::clone(&data);
    let _ = thread::spawn(move || {
        let _guard = data2.lock().unwrap();
        panic!("panicked while holding lock");
    }).join();

    // Lock is poisoned — can still recover the data
    match data.lock() {
        Ok(val) => println!("Value: {val}"),
        Err(poisoned) => println!("Recovered: {}", *poisoned.into_inner()),
    }
}`,
    seedQuestions: [
      "Why does Rust make you call .lock() before accessing the data inside a Mutex?",
      "What is lock poisoning, and why might you want to recover from it?",
      "When would you choose Mutex over channels for inter-thread communication?",
      "What happens if you hold a MutexGuard across an .await point or a long computation?",
    ],
  },

  {
    id: "rust-send-sync",
    title: "Send & Sync Traits",
    difficulty: "Advanced",
    icon: "🛡️",
    description:
      "Send and Sync are marker traits that the compiler uses to enforce thread safety. Send means a type can be transferred to another thread. Sync means a type can be referenced from multiple threads (&T is safe to share). Most types implement both automatically. Rc<T> is not Send (its refcount isn't atomic), so the compiler rejects it in thread::spawn. Arc<T> is Send + Sync because its refcount is atomic. RefCell<T> is Send but not Sync. You rarely implement these manually — the compiler does it for you.",
    concepts: [
      "Send trait (transfer between threads)",
      "Sync trait (shared references across threads)",
      "Rc is not Send (use Arc)",
      "RefCell is not Sync",
      "Compiler auto-implements Send/Sync",
    ],
    bridges: {
      "C++":
        "No equivalent — thread safety is entirely the programmer's responsibility. Rust's compiler enforces it through the type system.",
      Python:
        "The GIL provides some implicit safety for Python objects. Rust achieves safety without a GIL by using Send/Sync traits.",
      Java:
        "No equivalent — you use volatile/synchronized by convention. Rust makes thread-safety a type-level property the compiler checks.",
    },
    code: `use std::rc::Rc;
use std::sync::{Arc, Mutex};
use std::cell::RefCell;
use std::thread;

fn is_send<T: Send>() {}
fn is_sync<T: Sync>() {}

fn main() {
    // These types are Send + Sync (all compile)
    is_send::<i32>();       is_sync::<i32>();
    is_send::<String>();    is_sync::<String>();
    is_send::<Vec<i32>>();  is_sync::<Vec<i32>>();
    is_send::<Arc<String>>(); is_sync::<Arc<String>>();

    // Rc is NOT Send or Sync — refcount isn't atomic
    // is_send::<Rc<String>>();  // COMPILE ERROR
    // is_sync::<Rc<String>>();  // COMPILE ERROR

    // RefCell is Send but NOT Sync
    is_send::<RefCell<i32>>();
    // is_sync::<RefCell<i32>>();  // COMPILE ERROR

    // Rc fails across threads — Arc works
    let _rc = Rc::new(String::from("shared"));
    // thread::spawn(move || println!("{_rc}")); // ERROR: Rc not Send

    let arc_data = Arc::new(String::from("shared"));
    let arc_clone = Arc::clone(&arc_data);
    let handle = thread::spawn(move || println!("Thread: {arc_clone}"));
    handle.join().unwrap();
    println!("Main: {arc_data}");

    // Composed types inherit Send/Sync from contents
    is_send::<Vec<Arc<String>>>();  // OK: Arc is Send
    // is_send::<Vec<Rc<String>>>();   // ERROR: Rc is not Send

    // Mutex<T> makes T safe for multi-thread access
    is_send::<Mutex<RefCell<i32>>>();
    is_sync::<Mutex<RefCell<i32>>>();

    // Choosing the right wrapper:
    // Single-threaded shared ownership      -> Rc<T>
    // Multi-threaded shared ownership       -> Arc<T>
    // Single-threaded interior mutability   -> RefCell<T>
    // Multi-threaded interior mutability    -> Arc<Mutex<T>>
    println!("All trait checks passed!");
}`,
    seedQuestions: [
      "Why is Rc not Send — what would go wrong if you could send it to another thread?",
      "What's the difference between Send and Sync in practical terms?",
      "Why is RefCell Send but not Sync?",
      "How does the compiler decide whether a struct you define is Send or Sync?",
    ],
  },
] };
