export const rustTesting = { name: "Testing", lessons: [
  {
    id: "rust-unit-tests",
    title: "Unit Tests",
    difficulty: "Core",
    icon: "✅",
    description:
      "Rust has built-in unit testing: add #[test] to a function and run `cargo test`. Tests live right next to the code they test, inside a #[cfg(test)] module. They can test private functions directly since they're in the same module.",
    concepts: [
      "#[test] attribute",
      "assert macros (assert!, assert_eq!, assert_ne!)",
      "#[should_panic] for expected failures",
      "Testing private functions",
      "cargo test command",
    ],
    bridges: {
      "C++":
        "Like Google Test's TEST() macro, but built into the language. No separate test binary or linking step needed.",
      Python:
        "Like pytest functions with assert, but compiled into the same file. #[should_panic] is like pytest.raises().",
      Java: "Like JUnit's @Test and assertEquals, but tests live in the same file as the code, not a separate test class.",
    },
    code: `pub struct Wallet {
    balance: f64,
    currency: String,
}

impl Wallet {
    pub fn new(currency: &str) -> Self {
        Wallet { balance: 0.0, currency: currency.to_string() }
    }

    pub fn deposit(&mut self, amount: f64) -> Result<f64, String> {
        if amount <= 0.0 {
            return Err("Deposit must be positive".to_string());
        }
        self.balance += amount;
        Ok(self.balance)
    }

    pub fn withdraw(&mut self, amount: f64) -> Result<f64, String> {
        if amount > self.balance {
            return Err(format!("Insufficient funds: {} < {}", self.balance, amount));
        }
        self.balance -= amount;
        Ok(self.balance)
    }

    fn is_empty(&self) -> bool { self.balance == 0.0 }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn deposit_increases_balance() {
        let mut w = Wallet::new("USD");
        assert_eq!(w.deposit(50.0).unwrap(), 50.0);
        assert_eq!(w.deposit(25.0).unwrap(), 75.0);
    }

    #[test]
    fn withdraw_decreases_balance() {
        let mut w = Wallet::new("EUR");
        w.deposit(100.0).unwrap();
        assert_eq!(w.withdraw(40.0).unwrap(), 60.0);
    }

    #[test]
    fn withdraw_insufficient_funds() {
        let mut w = Wallet::new("USD");
        w.deposit(10.0).unwrap();
        let err = w.withdraw(50.0).unwrap_err();
        assert!(err.contains("Insufficient funds"));
    }

    #[test]
    fn reject_negative_deposit() {
        let mut w = Wallet::new("GBP");
        assert!(w.deposit(-5.0).is_err());
    }

    // Tests can return Result — no unwrap needed
    #[test]
    fn test_with_result() -> Result<(), String> {
        let mut w = Wallet::new("JPY");
        w.deposit(100.0)?;
        w.withdraw(50.0)?;
        assert_ne!(w.balance, 0.0);
        Ok(())
    }

    // Test private functions directly (same module)
    #[test]
    fn new_wallet_is_empty() {
        let w = Wallet::new("USD");
        assert!(w.is_empty()); // is_empty is private, but accessible here
    }
}`,
    seedQuestions: [
      "How can the tests access the private method is_empty()? Wouldn't that be forbidden from outside?",
      "What's the difference between assert!, assert_eq!, and assert_ne! — when would you use each?",
      "Why does #[cfg(test)] exist — what does it do to the test module in release builds?",
      "How does the test_with_result function work differently from the other tests?",
    ],
  },

  {
    id: "rust-integration-tests",
    title: "Integration Tests",
    difficulty: "Core",
    icon: "🔗",
    description:
      "Integration tests live in a separate tests/ directory and test your crate's public API as an external consumer would. Each file in tests/ compiles as its own crate. Shared helpers go in tests/common/mod.rs.",
    concepts: [
      "tests/ directory structure",
      "Integration vs unit tests",
      "Testing public API",
      "Common test helpers",
      "#[ignore] for slow tests",
    ],
    bridges: {
      "C++":
        "Like separate test binaries that link against your library. Rust automates the build and discovery.",
      Python:
        "Like test files in a tests/ directory. Rust's convention is the same — tests/ is for external-facing tests.",
      Java: "Like integration test directories in Maven/Gradle. Each test file sees only your public API.",
    },
    files: [
      {
        name: "src/lib.rs",
        code: `pub struct Config {
    pub max_retries: u32,
    pub timeout_ms: u64,
}

impl Config {
    pub fn default_config() -> Self {
        Config { max_retries: 3, timeout_ms: 5000 }
    }
}

pub fn fetch_data(url: &str, config: &Config) -> Result<String, String> {
    if url.is_empty() {
        return Err("URL cannot be empty".to_string());
    }
    if !url.starts_with("http") {
        return Err(format!("Invalid URL scheme: {url}"));
    }
    // Simulated response
    Ok(format!("data from {} (timeout: {}ms)", url, config.timeout_ms))
}

pub fn parse_csv(input: &str) -> Vec<Vec<String>> {
    input
        .lines()
        .map(|line| line.split(',').map(|s| s.trim().to_string()).collect())
        .collect()
}`,
      },
      {
        name: "tests/common/mod.rs",
        code: `// Shared test helpers — not a test file itself
use my_crate::Config;

pub fn test_config() -> Config {
    Config { max_retries: 1, timeout_ms: 100 }
}

pub fn sample_csv() -> &'static str {
    "name, age, city\\nAlice, 30, Berlin\\nBob, 25, Paris"
}`,
      },
      {
        name: "tests/fetch_tests.rs",
        code: `use my_crate::{fetch_data, Config};
mod common;

#[test]
fn fetch_with_valid_url() {
    let config = common::test_config();
    let result = fetch_data("https://api.example.com", &config);
    assert!(result.is_ok());
    assert!(result.unwrap().contains("api.example.com"));
}

#[test]
fn fetch_rejects_empty_url() {
    let config = Config::default_config();
    let err = fetch_data("", &config).unwrap_err();
    assert_eq!(err, "URL cannot be empty");
}

#[test]
fn fetch_rejects_bad_scheme() {
    let config = common::test_config();
    assert!(fetch_data("ftp://files.example.com", &config).is_err());
}

#[test]
#[ignore] // slow test — run with: cargo test -- --ignored
fn fetch_stress_test() {
    let config = common::test_config();
    for i in 0..1000 {
        let url = format!("https://api.example.com/{i}");
        assert!(fetch_data(&url, &config).is_ok());
    }
}`,
      },
      {
        name: "tests/csv_tests.rs",
        code: `use my_crate::parse_csv;
mod common;

#[test]
fn parse_csv_basic() {
    let data = common::sample_csv();
    let rows = parse_csv(data);
    assert_eq!(rows.len(), 3); // header + 2 data rows
    assert_eq!(rows[0][0], "name");
    assert_eq!(rows[1][0], "Alice");
}

#[test]
fn parse_csv_empty_input() {
    let rows = parse_csv("");
    assert!(rows.is_empty() || rows == vec![vec!["".to_string()]]);
}

#[test]
fn parse_csv_single_column() {
    let rows = parse_csv("a\\nb\\nc");
    assert_eq!(rows.len(), 3);
    assert_eq!(rows[0], vec!["a"]);
}`,
      },
    ],
    seedQuestions: [
      "Why can't integration tests access private functions, while unit tests can?",
      "How does `mod common;` import the shared helper — why is it tests/common/mod.rs and not tests/common.rs?",
      "What does #[ignore] do, and how would you run only the ignored tests?",
      "Why is each file in tests/ compiled as a separate crate? What does that mean for test isolation?",
    ],
  },

  {
    id: "rust-test-patterns",
    title: "Advanced Testing Patterns",
    difficulty: "Intermediate",
    icon: "🧪",
    description:
      "Beyond basic #[test]: test fixtures for setup/teardown, temporary files for I/O tests, doc tests that double as documentation and tests, and strategies for organizing a growing test suite.",
    concepts: [
      "Test fixtures and setup",
      "Temporary files in tests",
      "Property-based testing concepts",
      "Doc tests (/// examples)",
      "Test organization strategies",
    ],
    bridges: {
      "C++":
        "Like Google Test's SetUp/TearDown fixtures. Rust uses plain functions and RAII (Drop) instead of a fixture framework.",
      Python:
        "Like pytest fixtures and tmp_path. Rust's approach is more manual but equally effective — Drop handles cleanup.",
      Java: "Like JUnit's @BeforeEach. Rust doesn't have annotations for this — you write helper functions and rely on Drop.",
    },
    code: `use std::fs;
use std::path::{Path, PathBuf};

/// Adds two numbers together.
///
/// # Examples
///
/// \`\`\`
/// let result = my_crate::add(2, 3);
/// assert_eq!(result, 5);
/// \`\`\`
///
/// Negative numbers work too:
///
/// \`\`\`
/// assert_eq!(my_crate::add(-1, 1), 0);
/// \`\`\`
pub fn add(a: i32, b: i32) -> i32 { a + b }

pub fn write_log(path: &Path, entries: &[&str]) -> std::io::Result<()> {
    let content = entries.join("\\n");
    fs::write(path, content)
}

pub fn count_entries(path: &Path) -> std::io::Result<usize> {
    let content = fs::read_to_string(path)?;
    Ok(content.lines().count())
}

#[cfg(test)]
mod tests {
    use super::*;

    // --- Fixture pattern: setup struct with Drop for cleanup ---
    struct TempFile { path: PathBuf }

    impl TempFile {
        fn new(name: &str) -> Self {
            let path = std::env::temp_dir().join(name);
            TempFile { path }
        }
    }

    impl Drop for TempFile {
        fn drop(&mut self) {
            let _ = fs::remove_file(&self.path); // cleanup even if test fails
        }
    }

    // --- Shared setup helper ---
    fn setup_log(name: &str, entries: &[&str]) -> TempFile {
        let tmp = TempFile::new(name);
        write_log(&tmp.path, entries).unwrap();
        tmp
    }

    // --- Tests using the fixture ---
    #[test]
    fn write_and_count() {
        let tmp = setup_log("test_wc.log", &["entry1", "entry2", "entry3"]);
        assert_eq!(count_entries(&tmp.path).unwrap(), 3);
    } // tmp.drop() cleans up the file

    #[test]
    fn empty_log() {
        let tmp = setup_log("test_empty.log", &[]);
        let count = count_entries(&tmp.path).unwrap();
        assert!(count <= 1); // empty string may produce one empty line
    }

    // --- Organizing tests into submodules ---
    mod edge_cases {
        use super::*;

        #[test]
        fn missing_file() {
            let result = count_entries(Path::new("/nonexistent/file.log"));
            assert!(result.is_err());
        }
    }

    // --- Property-style testing (manual version) ---
    mod properties {
        use super::*;

        #[test]
        fn add_is_commutative() {
            for a in -50..50 {
                for b in -50..50 {
                    assert_eq!(add(a, b), add(b, a), "failed for ({a}, {b})");
                }
            }
        }

        #[test]
        fn add_identity() {
            for x in -100..100 {
                assert_eq!(add(x, 0), x);
            }
        }
    }
}`,
    seedQuestions: [
      "How does the TempFile struct ensure cleanup even if a test panics? What trait makes this work?",
      "What are doc tests (the /// examples) — how do they run, and why put tests in documentation?",
      "Why organize tests into nested modules like `mod edge_cases` and `mod properties`?",
      "How would you use a crate like proptest to replace the manual property-based tests shown here?",
    ],
  },
] };
