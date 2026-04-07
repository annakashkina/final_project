// Season 01 Arc 01 — C Programming Fundamentals

export const cFoundations = { name: "C Language Foundations", lessons: [
  {
    id: "s01-compilation",
    title: "Compilation & Program Structure",
    difficulty: "Beginner",
    icon: "\u{1F528}",
    description: "How C turns a text file into a running program.",
    concepts: [
      "gcc compiles .c files into executables",
      "#include brings in function declarations",
      "main() is the entry point",
      "return 0 means success",
    ],
    bridges: {
      Python: "Python runs code directly. C needs a compile step first.",
      JavaScript: "Like Node, but 'gcc file.c -o prog && ./prog' instead of 'node file.js'.",
    },
    files: [{
      name: "hello.c",
      code: `#include <stdio.h>

int main()
{
    printf("Hello!\\n");
    return 0;
}

// gcc -o hello hello.c
// ./hello`,
    }],
    seedQuestions: [
      "What does gcc actually produce?",
      "What does #include do before compilation?",
      "What happens if main returns 1 instead of 0?",
    ],
  },
  {
    id: "s01-types",
    title: "Types & printf",
    difficulty: "Beginner",
    icon: "\u{1F4E6}",
    description: "Every variable in C has a type. printf uses format specifiers to know how to print each type.",
    concepts: [
      "int — whole numbers, %d to print",
      "char — single character (ASCII number), %c to print",
      "char* — string (pointer to characters), %s to print",
      "Declare before use: type name = value;",
    ],
    bridges: {
      Python: "Python infers types. C requires you to declare them explicitly.",
      JavaScript: "Like 'let' but you name the type. The compiler catches type mismatches.",
    },
    files: [{
      name: "types.c",
      code: `#include <stdio.h>

int main()
{
    int n = 7;
    char c = 'Z';
    char *s = "world";

    printf("n=%d c=%c s=%s\\n", n, c, s);
    // n=7 c=Z s=world
    return 0;
}`,
    }],
    seedQuestions: [
      "Why does C need types when Python doesn't?",
      "What happens if you use %d to print a char?",
      "What's the difference between 'Z' and \"Z\"?",
    ],
  },
  {
    id: "s01-control-flow",
    title: "if, else, while",
    difficulty: "Beginner",
    icon: "\u{1F500}",
    description: "Branching with if/else, repeating with while. In C, zero is false, everything else is true.",
    concepts: [
      "if (condition) — zero is false, non-zero is true",
      "Comparisons: ==, !=, <, >, <=, >=",
      "Combine with && (and), || (or)",
      "while (condition) repeats until condition becomes 0",
    ],
    bridges: {
      Python: "Same logic, but braces {} instead of indentation. && instead of 'and', || instead of 'or'.",
      JavaScript: "Identical syntax for if/else/while.",
    },
    files: [{
      name: "flow.c",
      code: `#include <stdio.h>

int main()
{
    int x = 10;

    if (x > 5 && x < 20)
        printf("in range\\n");
    else
        printf("out of range\\n");

    int i = 0;
    while (i < 3)
    {
        printf("%d\\n", i);
        i++;
    }
    return 0;
}`,
    }],
    seedQuestions: [
      "What counts as 'true' in C?",
      "What's the difference between = and ==?",
      "What happens if you forget i++ inside the while?",
    ],
  },
  {
    id: "s01-functions",
    title: "Functions",
    difficulty: "Beginner",
    icon: "\u{1F4E4}",
    description: "Functions have a return type, a name, and typed parameters. void means no return value.",
    concepts: [
      "return_type name(param_type param) { ... }",
      "void — the function does something but returns nothing",
      "int/char — the function computes and returns a value",
      "Call with: name(arguments)",
    ],
    bridges: {
      Python: "Like def, but you declare parameter types and return type.",
      JavaScript: "Like function, but with types: 'int add(int a, int b)' instead of 'function add(a, b)'.",
    },
    files: [{
      name: "functions.c",
      code: `#include <stdio.h>

void greet(char *name)
{
    printf("Hi %s\\n", name);
}

int square(int n)
{
    return n * n;
}

int main()
{
    greet("Ada");
    printf("%d\\n", square(5)); // 25
    return 0;
}`,
    }],
    seedQuestions: [
      "When would you use void vs int as return type?",
      "Can a function call another function?",
      "What's a function prototype and when do you need one?",
    ],
  },
  {
    id: "s01-ascii",
    title: "Characters Are Numbers",
    difficulty: "Beginner",
    icon: "\u{1F524}",
    description: "Every char has an ASCII value. This lets you do math on characters and check ranges.",
    concepts: [
      "'a' is 97, 'z' is 122 — lowercase is a contiguous range",
      "'A' is 65, 'Z' is 90 — uppercase is 32 less than lowercase",
      "'0' is 48, '9' is 57 — digit chars are contiguous too",
      "You can compare, add, subtract characters",
    ],
    bridges: {
      Python: "Python needs ord('a') to get 97. In C, 'a' already IS 97.",
      JavaScript: "JS needs 'a'.charCodeAt(0). In C, chars are their values directly.",
    },
    files: [{
      name: "ascii.c",
      code: `#include <stdio.h>

int main()
{
    char c = 'a';
    printf("%c is %d\\n", c, c);     // a is 97
    printf("%c\\n", c + 3);           // d
    printf("%c\\n", 'A' + 2);         // C
    printf("%d\\n", 'z' - 'a');       // 25

    // Range check pattern
    if (c >= 'a' && c <= 'z')
        printf("lowercase\\n");

    return 0;
}`,
    }],
    seedQuestions: [
      "How would you convert a lowercase char to uppercase using math?",
      "How would you check if a char is a digit?",
      "Why is 'z' - 'a' equal to 25?",
    ],
  },
  {
    id: "s01-write",
    title: "write() — The System Call",
    difficulty: "Beginner",
    icon: "\u{270D}\uFE0F",
    description: "write() outputs raw bytes to a file descriptor. It's lower level than printf — and some exercises require it.",
    concepts: [
      "write(fd, buffer, count) — writes count bytes from buffer",
      "fd 1 = stdout (the screen)",
      "&c gives the address of a char — needed as the buffer",
      "Returns the number of bytes actually written",
    ],
    bridges: {
      Python: "Like sys.stdout.write() but at the OS level.",
      JavaScript: "Like process.stdout.write() — raw bytes, no formatting.",
    },
    files: [{
      name: "write_demo.c",
      code: `#include <unistd.h>

int main()
{
    char c = 'X';
    write(1, &c, 1);       // print one char
    write(1, "\\n", 1);     // newline

    write(1, "hello", 5);  // print 5 bytes
    write(1, "\\n", 1);
    return 0;
}`,
    }],
    seedQuestions: [
      "Why does write need &c instead of just c?",
      "What does the 1 in write(1, ...) mean?",
      "How would you print a string character by character with write?",
    ],
  },
]};

export const pointersMemory = { name: "Pointers & Memory", lessons: [
  {
    id: "s01-pointers",
    title: "Pointers — Addresses & Dereferencing",
    difficulty: "Core",
    icon: "\u{1F449}",
    description: "A pointer stores the address of another variable. With it, a function can reach back and modify the caller's data.",
    concepts: [
      "&x — the address of x",
      "int *p = &x — p holds x's address",
      "*p — the value AT that address (dereference)",
      "Passing &x to a function lets it modify x",
    ],
    bridges: {
      Python: "Everything in Python is a reference. C makes you choose: pass the value, or pass the address.",
      JavaScript: "Primitives are copied, objects are referenced. C pointers give you that choice explicitly.",
    },
    files: [{
      name: "pointers.c",
      code: `#include <stdio.h>

void double_it(int *p)
{
    *p = *p * 2;
}

int main()
{
    int x = 5;
    printf("x = %d\\n", x);      // 5

    double_it(&x);
    printf("x = %d\\n", x);      // 10

    int *p = &x;
    printf("*p = %d\\n", *p);    // 10
    printf("p = %p\\n", p);      // 0x7ff...
    return 0;
}`,
    }],
    seedQuestions: [
      "What happens if you pass x instead of &x to double_it?",
      "How would you swap two variables using pointers?",
      "What is a NULL pointer and what happens if you dereference it?",
    ],
  },
  {
    id: "s01-strings",
    title: "Strings — Null-Terminated Arrays",
    difficulty: "Core",
    icon: "\u{1F4DD}",
    description: "A C string is just a char pointer to the first character. The string ends where \\0 appears.",
    concepts: [
      "char *s = \"hi\" → s points to 'h', followed by 'i', then '\\0'",
      "s[i] accesses the i-th character",
      "Loop until s[i] == '\\0' to process the whole string",
      "This one loop pattern is behind strlen, putstr, and every string function",
    ],
    bridges: {
      Python: "Python strings know their length. C strings don't — you scan for \\0.",
      JavaScript: "JS strings have .length. C strings: you count characters yourself.",
    },
    files: [{
      name: "strings.c",
      code: `#include <stdio.h>

int main()
{
    char *s = "hello";

    // s in memory: ['h']['e']['l']['l']['o']['\\0']
    //               s[0] s[1] s[2] s[3] s[4] s[5]

    int i = 0;
    while (s[i] != '\\0')
    {
        printf("%c", s[i]);
        i++;
    }
    printf("\\n");
    // i is now the length
    return 0;
}`,
    }],
    seedQuestions: [
      "Why do C strings need \\0 at the end?",
      "What is s[i] when i goes past the end of the string?",
      "What's the difference between char *s and char s[]?",
      "How would you walk a string using a pointer instead of an index?",
    ],
  },
  {
    id: "s01-malloc",
    title: "malloc & free — Heap Memory",
    difficulty: "Core",
    icon: "\u{1F9F1}",
    description: "malloc allocates memory at runtime. You control when it's created and when it's freed.",
    concepts: [
      "malloc(n) gives you n bytes on the heap",
      "Returns NULL if allocation fails — always check",
      "free(ptr) releases the memory",
      "For strings: malloc(len + 1) — the +1 is for \\0",
    ],
    bridges: {
      Python: "Python/JS handle memory automatically. C makes you allocate and free yourself.",
    },
    files: [{
      name: "heap.c",
      code: `#include <stdlib.h>
#include <stdio.h>

int main()
{
    // Allocate 3 ints
    int *arr = malloc(sizeof(int) * 3);
    if (!arr)
        return 1;
    arr[0] = 10;
    arr[1] = 20;
    arr[2] = 30;
    printf("%d\\n", arr[1]); // 20
    free(arr);

    // Allocate space for a string
    char *s = malloc(6);  // 5 chars + \\0
    if (!s)
        return 1;
    // fill it, use it, then:
    free(s);
    return 0;
}`,
    }],
    seedQuestions: [
      "What happens if you forget to call free?",
      "Why malloc(len + 1) for strings?",
      "What's the difference between stack and heap memory?",
      "What happens if you use memory after freeing it?",
    ],
  },
]};

export const stringWork = { name: "Working with Strings", lessons: [
  {
    id: "s01-string-patterns",
    title: "The Universal String Loop",
    difficulty: "Intermediate",
    icon: "\u{1F504}",
    description: "Every string function — strlen, strcpy, strcmp, strchr — is built on the same loop. Learn the loop, build anything.",
    concepts: [
      "Walk: while (s[i] != '\\0') { ... i++; }",
      "Two strings in parallel: while (s1[i] && s2[i]) { ... }",
      "Copy: dst[i] = src[i] inside the walk loop",
      "Search: add an if inside the walk loop, return when found",
    ],
    bridges: {
      Python: "Python hides these loops behind len(), ==, find(). In C you write them.",
      JavaScript: "JS has indexOf, includes, slice. These are the loops those methods run internally.",
    },
    files: [{
      name: "patterns.c",
      code: `#include <stdio.h>

// Pattern 1: Walk one string — count vowels
int count_vowels(char *s)
{
    int i = 0;
    int count = 0;
    while (s[i] != '\\0')
    {
        if (s[i] == 'a' || s[i] == 'e' || s[i] == 'i'
            || s[i] == 'o' || s[i] == 'u')
            count++;
        i++;
    }
    return count;
}

// Pattern 2: Walk two strings together — same prefix?
int same_start(char *a, char *b, int n)
{
    int i = 0;
    while (a[i] && b[i] && i < n)
    {
        if (a[i] != b[i])
            return 0;
        i++;
    }
    return 1;
}

// Pattern 3: Search — find first digit
int find_digit(char *s)
{
    int i = 0;
    while (s[i])
    {
        if (s[i] >= '0' && s[i] <= '9')
            return i;
        i++;
    }
    return -1;
}

int main()
{
    printf("%d\\n", count_vowels("hello"));    // 2
    printf("%d\\n", same_start("abc", "abd", 2)); // 1
    printf("%d\\n", find_digit("room 42"));    // 5
    return 0;
}`,
    }],
    seedQuestions: [
      "How would you adapt the walk loop to copy one string into another?",
      "What happens if you forget to stop at \\0?",
      "How would you search for the LAST occurrence instead of the first?",
      "Why does substring search need a loop inside a loop?",
    ],
  },
  {
    id: "s01-in-place",
    title: "Swapping & In-Place Modification",
    difficulty: "Intermediate",
    icon: "\u{1F500}",
    description: "An in-place algorithm transforms data without extra allocation. The key operation: swap with a temp variable.",
    concepts: [
      "Swap: save one value in tmp, overwrite it, put tmp in the other",
      "In-place means no malloc — you modify the original",
      "Two-pointer technique: one from each end, walk inward",
      "char s[] is writable; char *s = \"...\" is read-only",
    ],
    bridges: {
      Python: "Python lets you do a, b = b, a. C needs an explicit temp variable.",
      JavaScript: "JS has destructuring [a,b]=[b,a]. C: you swap manually.",
    },
    files: [{
      name: "inplace.c",
      code: `#include <stdio.h>

void swap(int *a, int *b)
{
    int tmp = *a;
    *a = *b;
    *b = tmp;
}

// Two-pointer technique: reverse an int array
void reverse_array(int *arr, int len)
{
    int left = 0;
    int right = len - 1;
    while (left < right)
    {
        swap(&arr[left], &arr[right]);
        left++;
        right--;
    }
}

int main()
{
    int nums[] = {1, 2, 3, 4, 5};
    reverse_array(nums, 5);

    int i = 0;
    while (i < 5)
        printf("%d ", nums[i++]);
    // 5 4 3 2 1
    printf("\\n");

    // Same idea works on chars in a writable string
    char word[] = "abcd";
    char tmp = word[0];
    word[0] = word[3];
    word[3] = tmp;
    printf("%s\\n", word); // dbca
    return 0;
}`,
    }],
    seedQuestions: [
      "Why do you need a temp variable to swap?",
      "How would you apply this two-pointer technique to reverse a string?",
      "Why does char *s = \"hello\" crash when you modify it, but char s[] works?",
      "What happens if left and right meet in the middle — do you swap?",
    ],
  },
]};

export const dataStructures = { name: "Data Structures", lessons: [
  {
    id: "s01-structs",
    title: "Structs",
    difficulty: "Core",
    icon: "\u{1F4D0}",
    description: "A struct groups variables into one type. Access with dot (.) for values, arrow (->) for pointers.",
    concepts: [
      "struct { int x; int y; } — groups fields together",
      "typedef gives the struct a short name",
      "value.field — dot for struct values",
      "pointer->field — arrow for struct pointers",
    ],
    bridges: {
      Python: "Like a class with only attributes, no methods.",
      JavaScript: "Like { x: 0, y: 0 } but with fixed, typed fields.",
    },
    files: [{
      name: "struct.c",
      code: `#include <stdio.h>

typedef struct {
    int x;
    int y;
} point;

void print_point(point *p)
{
    printf("(%d, %d)\\n", p->x, p->y);
}

int main()
{
    point a = { .x = 3, .y = 7 };
    printf("%d\\n", a.x);       // dot: 3
    print_point(&a);            // arrow inside: (3, 7)
    return 0;
}`,
    }],
    seedQuestions: [
      "When do you use . vs ->?",
      "How would you define a struct with a size and an array inside?",
      "Why pass a struct pointer to a function instead of the whole struct?",
    ],
  },
  {
    id: "s01-char-star-star",
    title: "char** — Arrays of Strings",
    difficulty: "Intermediate",
    icon: "\u{1F4DA}",
    description: "char** is an array of string pointers. It's how argv works, and how you handle collections of text in C.",
    concepts: [
      "char** — each element is a char* pointing to a string",
      "argv in main() is the most common char**",
      "Wrap in a struct with size for safe iteration",
      "Building new strings: calculate length first, then malloc",
    ],
    bridges: {
      Python: "Like a list of strings. C uses char** with a separate size.",
      JavaScript: "Like an array of strings, but no .length — you track size yourself.",
    },
    files: [{
      name: "string_array.c",
      code: `#include <stdio.h>

int main(int argc, char **argv)
{
    // argv is a char**
    // argv[0] = program name
    // argv[1], argv[2], ... = arguments

    int i = 0;
    while (i < argc)
    {
        printf("argv[%d] = %s\\n", i, argv[i]);
        i++;
    }
    return 0;
}

// char **words:
//   words[0] -> "hello"
//   words[1] -> "world"
//   words[2] -> NULL`,
    }],
    seedQuestions: [
      "What's the difference between char* and char**?",
      "How do you iterate a char** if you know the size?",
      "Why does joining strings need two passes — count then fill?",
    ],
  },
]};

export const buildingPrograms = { name: "Building Programs", lessons: [
  {
    id: "s01-argc-argv",
    title: "Command-Line Arguments",
    difficulty: "Intermediate",
    icon: "\u{1F4BB}",
    description: "Programs receive arguments via argc (count) and argv (values). All arguments are strings — use atoi for numbers.",
    concepts: [
      "argc — how many arguments (including program name)",
      "argv[0] — the program name",
      "argv[1..] — user-supplied arguments, always strings",
      "atoi(argv[i]) — convert string argument to int",
    ],
    bridges: {
      Python: "Like sys.argv. Same concept, same indexing.",
      JavaScript: "Like process.argv in Node.",
    },
    files: [{
      name: "args.c",
      code: `#include <stdio.h>
#include <stdlib.h>

// ./program 42 hello
//   argc = 3
//   argv[0] = "./program"
//   argv[1] = "42"   <- string, not int!
//   argv[2] = "hello"

int main(int argc, char **argv)
{
    if (argc < 2)
        return 1;
    int n = atoi(argv[1]);
    printf("Got %d\\n", n);
    return 0;
}`,
    }],
    seedQuestions: [
      "Why is argv[1] a string even when the user types a number?",
      "How do you handle missing arguments safely?",
      "How would you loop through all arguments?",
    ],
  },
  {
    id: "s01-file-io",
    title: "File Descriptors & File I/O",
    difficulty: "Intermediate",
    icon: "\u{1F4C4}",
    description: "Files are accessed through file descriptors — small integers. The cycle: open, read, close.",
    concepts: [
      "open(path, O_RDONLY) returns a file descriptor (int)",
      "read(fd, buf, n) reads up to n bytes, returns how many",
      "read returns 0 at end of file",
      "close(fd) when done — 0=stdin, 1=stdout, 2=stderr",
    ],
    bridges: {
      Python: "Python's open() wraps these syscalls in a nice object.",
      JavaScript: "Node's fs module wraps these. C gives you the raw syscalls.",
    },
    files: [{
      name: "filesize.c",
      code: `#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>

// Print the byte count of a file
int main()
{
    int fd = open("filesize.c", O_RDONLY);
    if (fd == -1)
    {
        write(2, "open failed\\n", 12);
        return 1;
    }

    char buf[1024];
    int total = 0;
    int n;
    while ((n = read(fd, buf, 1024)) > 0)
        total += n;

    close(fd);
    printf("%d bytes\\n", total);
    return 0;
}

// fd 0 = stdin, 1 = stdout, 2 = stderr
// open() returns 3, 4, 5, ...
// read() returns 0 at end of file`,
    }],
    seedQuestions: [
      "Why is a file descriptor just an integer?",
      "How would you print the file's content instead of counting bytes?",
      "What happens if open() fails and you try to read from fd -1?",
      "How would you handle multiple filenames from argv?",
    ],
  },
  {
    id: "s01-counting",
    title: "Array-as-Index Counting",
    difficulty: "Intermediate",
    icon: "\u{1F4CA}",
    description: "Use a character's ASCII value as an array index to count occurrences in O(1). No searching needed.",
    concepts: [
      "int counts[256] = {0} — one slot per ASCII value",
      "counts[(unsigned char)c]++ — the value IS the index",
      "Walk the array 0..255 to read results in sorted order",
      "Same pattern works for any bounded set of values",
    ],
    bridges: {
      Python: "This is what collections.Counter does internally.",
      JavaScript: "Like a frequency map {}, but O(1) lookup via array index.",
    },
    files: [{
      name: "digit_freq.c",
      code: `#include <stdio.h>

// Count how often each digit 0-9 appears
void count_digits(char *s)
{
    int freq[10] = {0};
    int i = 0;

    while (s[i])
    {
        if (s[i] >= '0' && s[i] <= '9')
            freq[s[i] - '0']++;
        i++;
    }

    int d = 0;
    while (d < 10)
    {
        if (freq[d] > 0)
            printf("%d: %d\\n", d, freq[d]);
        d++;
    }
}

int main()
{
    count_digits("call 555-0123");
    // 0: 1
    // 1: 1
    // 2: 1
    // 3: 1
    // 5: 3
    return 0;
}

// The trick: the value IS the index
// freq['5' - '0'] is freq[5]
// Walking 0..9 gives sorted output for free`,
    }],
    seedQuestions: [
      "How would you scale this to count ALL characters, not just digits?",
      "Why does walking the array give sorted output automatically?",
      "How would you handle multiple strings passed as arguments?",
      "What does (unsigned char) do and why might you need it?",
    ],
  },
]};

export const unixShell = { name: "Unix & Tools", lessons: [
  {
    id: "s01-shell",
    title: "find, pipes, wc",
    difficulty: "Core",
    icon: "\u{1F41A}",
    description: "Shell commands for searching files and chaining operations.",
    concepts: [
      "find . -name '*.c' — recursive file search",
      "find -type f (files) -type d (directories)",
      "| (pipe) — feed output of one command into another",
      "wc -l — count lines",
    ],
    bridges: {
      Python: "Like glob + os.walk as one-liners.",
      JavaScript: "Like recursive readdir + filter.",
    },
    files: [{
      name: "shell.sh",
      code: `# Find all .c files
find . -name "*.c"

# Count files and directories
find . | wc -l

# Chain commands with pipes
ls -la | grep ".c" | wc -l

# Run a command on each found file
find . -name "*.sh" -exec basename {} .sh \\;`,
    }],
    seedQuestions: [
      "How does pipe connect two commands?",
      "What does {} mean in find -exec?",
      "How would you delete all files ending with ~?",
    ],
  },
  {
    id: "s01-diff-patch",
    title: "diff & patch",
    difficulty: "Core",
    icon: "\u{1F4DD}",
    description: "diff shows what changed between two files. patch applies those changes. This is how git works underneath.",
    concepts: [
      "diff a b — shows changes to turn a into b",
      "patch a < diff_file — applies the changes",
      "< means removed line, > means added line",
      "git diff = same concept, every commit is a patch",
    ],
    bridges: {
      Python: "Like difflib. This is the foundation of git.",
    },
    files: [{
      name: "diff.sh",
      code: `# Create a diff
diff original.txt modified.txt > changes.diff

# Apply it
patch original.txt < changes.diff

# Output format:
#   1,2c1,3   lines changed
#   < old     removed
#   > new     added`,
    }],
    seedQuestions: [
      "What do the numbers like '1,2c1,3' mean?",
      "Can you reverse a patch?",
      "How does this relate to git diff?",
    ],
  },
  {
    id: "s01-makefiles",
    title: "Makefiles",
    difficulty: "Intermediate",
    icon: "\u2699\uFE0F",
    description: "Makefiles automate compiling multi-file projects. They only rebuild what changed.",
    concepts: [
      "target: dependencies \\n\\trecipe",
      "all, clean, fclean, re — standard targets",
      ".h headers declare functions, .c files define them",
      "-Wall -Wextra -Werror — catch bugs at compile time",
    ],
    bridges: {
      Python: "Like a build script. Make tracks file timestamps.",
      JavaScript: "Like npm scripts, but smarter about what needs rebuilding.",
    },
    files: [{
      name: "Makefile",
      code: `NAME = my_program
SRC  = main.c utils.c
OBJ  = $(SRC:.c=.o)
CC   = gcc
CFLAGS = -Wall -Wextra -Werror

all: $(NAME)

$(NAME): $(OBJ)
\t$(CC) $(CFLAGS) -o $(NAME) $(OBJ)

%.o: %.c
\t$(CC) $(CFLAGS) -c $< -o $@

clean:
\trm -f $(OBJ)

fclean: clean
\trm -f $(NAME)

re: fclean all`,
    }, {
      name: "headers.txt",
      code: `// .h files: declare what functions exist
//   int my_strlen(char *s);
//
// .c files: define how they work
//   int my_strlen(char *s) { ... }
//
// Rule: #include "file.h", never #include "file.c"`,
    }],
    seedQuestions: [
      "What do $< and $@ mean?",
      "Why use .h headers instead of just putting everything in one file?",
      "How does Make know what to recompile?",
    ],
  },
]};

export const advancedConcepts = { name: "Advanced Concepts", lessons: [
  {
    id: "s01-read-stdin",
    title: "read() from stdin",
    difficulty: "Advanced",
    icon: "\u{1F3AE}",
    description: "read(0, &c, 1) reads one raw byte from the keyboard. This is how you build interactive programs in C.",
    concepts: [
      "read(0, &c, 1) — read 1 byte from stdin into c",
      "Returns 1 on success, 0 on EOF (Ctrl+D)",
      "Loop read calls to build a line, stop at '\\n'",
      "Game loop: prompt → read → validate → respond → repeat",
    ],
    bridges: {
      Python: "input() does all this for you. C gives you the raw bytes.",
      JavaScript: "Like readline but at the syscall level.",
    },
    files: [{
      name: "read.c",
      code: `#include <unistd.h>

int main()
{
    char c;

    // Read and echo one character
    if (read(0, &c, 1) > 0)
        write(1, &c, 1);
    // read returns 0 on Ctrl+D (EOF)

    return 0;
}

// To read a line:
//   loop read(0, &c, 1)
//   append c to buffer
//   stop when c == '\\n' or read returns 0`,
    }],
    seedQuestions: [
      "Why read one byte at a time?",
      "What does Ctrl+D do and how does read() report it?",
      "How would you build a buffer from individual bytes?",
    ],
  },
  {
    id: "s01-variadic",
    title: "Variadic Functions",
    difficulty: "Advanced",
    icon: "\u{1F5A8}\uFE0F",
    description: "Functions that take a variable number of arguments. This is how printf works — the format string tells it what types to expect.",
    concepts: [
      "#include <stdarg.h> — va_list, va_start, va_arg, va_end",
      "va_start(args, last_fixed) — initialize after last known param",
      "va_arg(args, type) — pull the next argument as that type",
      "The format string is the guide: %d → va_arg(args, int)",
    ],
    bridges: {
      Python: "Like *args. printf reads the format string to know what types to pull.",
      JavaScript: "Like ...rest. The format string acts as a type manifest.",
    },
    files: [{
      name: "variadic.c",
      code: `#include <stdarg.h>
#include <stdio.h>

int sum(int count, ...)
{
    va_list args;
    va_start(args, count);

    int total = 0;
    while (count-- > 0)
        total += va_arg(args, int);

    va_end(args);
    return total;
}

int main()
{
    printf("%d\\n", sum(3, 10, 20, 30)); // 60
    return 0;
}`,
    }],
    seedQuestions: [
      "How does va_arg know the size of the next argument?",
      "What happens if you call va_arg with the wrong type?",
      "How would a printf-like function use the format string to decide types?",
    ],
  },
  {
    id: "s01-number-bases",
    title: "Number Base Conversion",
    difficulty: "Advanced",
    icon: "\u{1F522}",
    description: "Convert numbers to any base by repeatedly dividing and collecting remainders. Recursion prints digits in the right order.",
    concepts: [
      "n % base = last digit, n / base = remaining number",
      "Digits come out reversed — least significant first",
      "Recursion fixes the order: recurse first, then print",
      "%d=decimal %o=octal %x=hex %u=unsigned",
    ],
    bridges: {
      Python: "Python has bin(), oct(), hex(). In C, you implement the conversion.",
    },
    files: [{
      name: "bases.c",
      code: `#include <unistd.h>

// Print n in any base using recursion
// Recursion prints higher digits first, then this digit
void put_nbr_base(int n, char *base, int base_len)
{
    if (n >= base_len)
        put_nbr_base(n / base_len, base, base_len);
    char c = base[n % base_len];
    write(1, &c, 1);
}

int main()
{
    put_nbr_base(42, "01", 2);        // binary: 101010
    write(1, "\\n", 1);
    put_nbr_base(255, "0123456789abcdef", 16); // hex: ff
    write(1, "\\n", 1);
    put_nbr_base(100, "01234567", 8);  // octal: 144
    write(1, "\\n", 1);
    return 0;
}

// n % base  = last digit (ones place)
// n / base  = everything above it
// Recurse first, print after = correct order`,
    }],
    seedQuestions: [
      "Why do remainders come out in reverse order without recursion?",
      "What happens if you print BEFORE the recursive call instead of after?",
      "How would you handle negative numbers?",
      "Why is the base passed as a string of digit characters?",
    ],
  },
  {
    id: "s01-state-machines",
    title: "State Machines",
    difficulty: "Advanced",
    icon: "\u{1F680}",
    description: "A state machine tracks current state and changes it based on input. Used for games, parsers, and simulations.",
    concepts: [
      "State: variables describing current situation",
      "Input: commands/events arriving one at a time",
      "Transition: rules for how input changes state",
      "Modular arithmetic: (dir + 1) % 4 cycles through 4 directions",
    ],
    bridges: {
      Python: "Like turtle graphics. State + command = new state.",
      JavaScript: "Like React's useState. Same pattern: state + action = next state.",
    },
    files: [{
      name: "robot.c",
      code: `#include <stdio.h>

// A robot on a grid that follows instructions
// State: position (x, y) and facing direction
int main()
{
    // Directions: 0=up 1=right 2=down 3=left
    int dx[] = { 0, 1, 0, -1};
    int dy[] = {-1, 0, 1,  0};

    int x = 0, y = 0, dir = 0;
    char *cmds = "AARA";  // advance, advance, right, advance

    int i = 0;
    while (cmds[i])
    {
        if (cmds[i] == 'R')
            dir = (dir + 1) % 4;
        else if (cmds[i] == 'L')
            dir = (dir + 3) % 4;  // NOT -1, C modulo is buggy with negatives
        else if (cmds[i] == 'A')
        {
            x += dx[dir];
            y += dy[dir];
        }
        i++;
    }

    printf("x=%d y=%d dir=%d\\n", x, y, dir);
    // x=1 y=-2 dir=1 (facing right)
    return 0;
}

// The pattern: state + input = new state
// dir arrays let you advance without if/else per direction
// % 4 wraps around: after direction 3 comes 0`,
    }],
    seedQuestions: [
      "Why (dir + 3) % 4 instead of (dir - 1) % 4?",
      "How do the dx/dy arrays eliminate the need for if/else per direction?",
      "How would you turn this into a function that returns the final position as a string?",
      "What would change if you needed to track and return the position as formatted output?",
    ],
  },
]};
