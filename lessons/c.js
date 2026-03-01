export const cLessons = [
  {
    id: "c-if-else",
    lang: "c",
    title: "If, Else & Comparisons",
    difficulty: "Beginner",
    icon: "🔀",
    description:
      "Branching in C looks familiar but has sharp edges — no boolean type in old C, and = vs == will bite you.",
    concepts: [
      "if / else if / else",
      "Comparison operators",
      "Truthiness (0 is false, everything else is true)",
      "Common pitfall: = vs ==",
    ],
    bridges: {
      Python: "Python uses 'elif' and indentation. C uses 'else if' and braces. C has no True/False — just 0 and non-zero.",
      JavaScript: "Almost identical syntax, but JS has === for strict equality. C only has == (and it compares raw values).",
      Java: "Nearly the same syntax. But C has no boolean type (before C99) — it uses int, where 0 = false.",
    },
    code: `#include <stdio.h>

int main(void) {
    int temp = 72;

    if (temp > 90) {
        printf("hot\\n");
    } else if (temp > 70) {
        printf("nice\\n");          // this prints
    } else {
        printf("cold\\n");
    }

    // 0 is false, ANYTHING else is true
    int x = 42;
    if (x) printf("truthy\\n");     // prints! 42 != 0

    // Classic bug: = vs ==
    int score = 100;
    if (score = 0) {               // BUG! ASSIGNS 0, doesn't compare
        printf("zero\\n");
    }
    printf("score is now %d\\n", score);  // 0 — oops

    return 0;
}`,
    seedQuestions: [
      "Why does 'if (score = 0)' not do what you'd expect?",
      "Why is 42 considered 'true' in C?",
      "What would happen if you wrote if (x = 5) instead of if (x == 5)?",
    ],
  },

  {
    id: "c-loops",
    lang: "c",
    title: "Loops: for, while, do-while",
    difficulty: "Beginner",
    icon: "🔁",
    description:
      "C has three loop types. The for loop packs init, condition, and update into one line — compact but easy to misread at first.",
    concepts: [
      "for loop (init; condition; update)",
      "while loop",
      "do-while (runs at least once)",
      "break and continue",
    ],
    bridges: {
      Python: "Python's 'for x in range(n)' is C's 'for (int i = 0; i < n; i++)'. C loops are more explicit — you control every part.",
      JavaScript: "Same for/while syntax. But C has no for..of or forEach — just index-based loops.",
      Java: "Identical syntax. But C has no enhanced for-each — you always use an index or pointer.",
    },
    code: `#include <stdio.h>

int main(void) {
    // for: init; condition; update
    for (int i = 0; i < 5; i++) {
        printf("%d ", i);          // 0 1 2 3 4
    }
    printf("\\n");

    // while: check before each iteration
    int count = 3;
    while (count > 0) {
        printf("%d.. ", count--);  // 3.. 2.. 1..
    }

    // do-while: runs body first, then checks
    int x = 0;
    do {
        printf("x=%d\\n", x);
    } while (x > 0);   // prints once even though condition is false

    // break exits, continue skips
    for (int i = 0; i < 10; i++) {
        if (i % 2 == 0) continue; // skip even
        if (i > 5) break;         // stop at 5
        printf("%d ", i);         // 1 3 5
    }

    return 0;
}`,
    seedQuestions: [
      "What are the three parts inside for(;;) and when does each run?",
      "When would you use do-while instead of while?",
      "What does 'continue' skip — the rest of the body or the whole loop?",
      "What would happen if you forget count-- in the while loop?",
    ],
  },

  {
    id: "c-switch",
    lang: "c",
    title: "Switch & Fall-through",
    difficulty: "Beginner",
    icon: "🔀",
    description:
      "Switch in C jumps to a matching label — then keeps running unless you break. This 'fall-through' behavior is a common source of bugs and a deliberate feature.",
    concepts: [
      "switch / case / default",
      "Fall-through behavior",
      "break to stop fall-through",
      "When fall-through is useful",
    ],
    bridges: {
      Python: "Python 3.10 added match/case but it doesn't fall through. C's switch always falls through unless you break.",
      JavaScript: "Same switch syntax AND same fall-through behavior. If you know JS switch, you know C switch.",
      Java: "Same syntax and fall-through. But Java switch can match Strings — C switch only works with integers.",
    },
    code: `#include <stdio.h>

int main(void) {
    int day = 3;
    switch (day) {
        case 1: printf("Monday\\n");    break;
        case 2: printf("Tuesday\\n");   break;
        case 3: printf("Wednesday\\n"); break;
        default: printf("other\\n");    break;
    }

    // Without break → fall-through!
    int grade = 8;
    switch (grade) {
        case 10:
        case 9:  printf("A\\n"); break;
        case 8:  printf("B\\n");        // prints B...
        case 7:  printf("C\\n"); break; // ...AND C! (no break above)
        default: printf("F\\n");
    }

    return 0;
}`,
    seedQuestions: [
      "What prints when grade is 8 — why does it print two letters?",
      "Why is fall-through the default instead of auto-breaking?",
      "Can you use switch with strings in C?",
    ],
  },

  {
    id: "c-printf-format",
    lang: "c",
    title: "printf & Format Strings",
    difficulty: "Beginner",
    icon: "🖨️",
    description:
      "printf is how C talks to you. The format string is a mini-language: %d for ints, %s for strings, %f for floats — and if you get it wrong, anything can happen.",
    concepts: [
      "Format specifiers (%d, %s, %f, %x, %p)",
      "Width and precision (%-10s, %.2f)",
      "Escape sequences (\\n, \\t, \\\\)",
      "Format string dangers",
    ],
    bridges: {
      Python: "Like f-strings but manual: printf(\"%s is %d\", name, age) vs f\"{name} is {age}\". Python checks types for you — C doesn't.",
      JavaScript: "Like template literals but printf doesn't check types. console.log() auto-converts; printf crashes on wrong type.",
      Java: "System.out.printf() is identical syntax — Java borrowed it from C. But Java throws exceptions on type mismatch; C just gives garbage.",
    },
    code: `#include <stdio.h>

int main(void) {
    char name[] = "Alice";
    int age = 25;
    float gpa = 3.87;

    printf("Name: %s\\n", name);       // string
    printf("Age:  %d\\n", age);        // integer
    printf("GPA:  %f\\n", gpa);        // 3.870000 (6 decimals)
    printf("GPA:  %.2f\\n", gpa);      // 3.87 (2 decimals)
    printf("Hex:  %x\\n", 255);        // ff
    printf("Char: %c\\n", 'A');        // single character

    // Width: %-10s = left-aligned, 10 wide
    printf("[%-10s]\\n", name);        // [Alice     ]
    printf("[%10s]\\n", name);         // [     Alice]

    // DANGER: wrong specifier = undefined behavior
    // printf("%d\\n", 3.14);   // expects int, gets float → garbage
    // printf("%s\\n", 42);     // expects char*, gets int → crash

    return 0;
}`,
    seedQuestions: [
      "What does %.2f do differently from %f?",
      "What happens if you pass a float to %d — why doesn't C catch that?",
      "What does the - in %-10s do?",
      "Why is passing the wrong type to printf dangerous, not just wrong?",
    ],
  },

  {
    id: "c-argc-argv",
    lang: "c",
    title: "argc & argv: Command-Line Args",
    difficulty: "Beginner",
    icon: "💻",
    description:
      "Every C program can receive arguments from the terminal. argc counts them, argv holds them as strings — including the program name itself.",
    concepts: [
      "argc (argument count)",
      "argv (argument vector — array of strings)",
      "argv[0] is the program name",
      "Converting strings to numbers (atoi)",
    ],
    bridges: {
      Python: "Like sys.argv, but C splits it into argc (count) and argv (values). Python gives you just the list.",
      JavaScript: "Like process.argv in Node. Same idea — argv[0] is the runtime, argv[1] is the script.",
      Java: "Like String[] args in main(), but C also gives you argc for the count, and argv[0] is the program name.",
    },
    code: `#include <stdio.h>
#include <stdlib.h>

// ./greet Alice 25
//   argc = 3
//   argv[0] = "./greet"  argv[1] = "Alice"  argv[2] = "25"

int main(int argc, char *argv[]) {
    if (argc < 3) {
        printf("Usage: %s <name> <age>\\n", argv[0]);
        return 1;
    }

    char *name = argv[1];
    int age = atoi(argv[2]);   // string → int (returns 0 on failure)

    printf("Hello %s, you are %d\\n", name, age);
    return 0;
}`,
    seedQuestions: [
      "Why is argv[0] the program name — who puts it there?",
      "Why is argc 3 when you type two arguments?",
      "What's the problem with atoi for real programs?",
      "What does 'return 1' mean from main?",
    ],
  },

  {
    id: "c-pointers",
    lang: "c",
    title: "Pointers & Addresses",
    difficulty: "Essential",
    icon: "🎯",
    description:
      "Every variable lives somewhere in memory. A pointer is just a variable that stores that location. Once this clicks, C makes sense.",
    concepts: [
      "Address-of operator (&)",
      "Dereference operator (*)",
      "Pointer declaration",
    ],
    bridges: {
      Python: "Python hides all pointers behind references. In C you see the addresses directly.",
      Java: "Java references are auto-dereferenced pointers. C makes you dereference yourself with *.",
      JavaScript: "Objects in JS are passed by reference automatically. C makes you choose.",
    },
    code: `#include <stdio.h>

int main(void) {
    int x = 10;
    int *p = &x;     // p stores the ADDRESS of x

    printf("x  = %d\\n", x);    // 10
    printf("&x = %p\\n", &x);   // some address like 0x7ffd...
    printf("p  = %p\\n", p);    // same address!
    printf("*p = %d\\n", *p);   // 10 — follow the pointer to get the value

    *p = 42;                    // change x THROUGH the pointer
    printf("x  = %d\\n", x);    // 42 — x changed!

    return 0;
}`,
    seedQuestions: [
      "What's the difference between p and *p?",
      "What does &x give you?",
      "Why did x change to 42 when we only wrote to *p?",
    ],
  },

  {
    id: "c-arrays-strings",
    lang: "c",
    title: "Arrays & Strings",
    difficulty: "Essential",
    icon: "📝",
    description:
      "C has no string type. A string is just an array of characters with a zero byte at the end. This is why C strings feel so different.",
    concepts: [
      "Arrays as contiguous memory",
      "Null-terminated strings (\\0)",
      "sizeof vs strlen",
      "Why you can't compare strings with ==",
    ],
    bridges: {
      Python: "Python strings are objects with len(). C strings are char arrays — you measure them with strlen().",
      Java: "Java String is an object with methods. C strings are raw bytes in memory.",
      JavaScript: "JS strings are safe and immutable. C strings are mutable memory you can overflow.",
    },
    code: `#include <stdio.h>
#include <string.h>

int main(void) {
    // A string is just a char array ending with '\\0'
    char greeting[] = "Hello";

    printf("strlen = %lu\\n", strlen(greeting));   // 5 characters
    printf("sizeof = %lu\\n", sizeof(greeting));   // 6 bytes! (the hidden \\0)

    // You can look at each byte
    for (int i = 0; i <= 5; i++) {
        printf("  [%d] = '%c' (%d)\\n", i, greeting[i], greeting[i]);
    }
    // [5] is the null terminator: '\\0' (0)

    // Strings are mutable arrays
    greeting[0] = 'J';
    printf("%s\\n", greeting);  // "Jello"

    // Comparing strings: == compares ADDRESSES, not content!
    char a[] = "cat";
    char b[] = "cat";
    if (a == b) {
        printf("same\\n");       // NEVER prints — different arrays
    }
    if (strcmp(a, b) == 0) {
        printf("equal!\\n");     // this is how you compare strings
    }

    // An int array — same idea, contiguous memory
    int nums[] = {10, 20, 30};
    printf("nums[1] = %d\\n", nums[1]);  // 20
    printf("length = %lu\\n", sizeof(nums) / sizeof(nums[0]));  // 3

    return 0;
}`,
    seedQuestions: [
      "Why is sizeof 6 when the string only has 5 letters?",
      "What is the '\\0' at the end and why does C need it?",
      "Why doesn't == work for comparing strings?",
      "How would you find the length of the nums array?",
    ],
  },

  {
    id: "c-malloc",
    lang: "c",
    title: "malloc & free",
    difficulty: "Core",
    icon: "🧠",
    description:
      "Local variables disappear when the function ends. malloc lets you allocate memory that sticks around — but you have to free it yourself.",
    concepts: [
      "Stack vs heap: why it matters",
      "malloc and free",
      "Checking for NULL",
      "Memory leaks",
    ],
    bridges: {
      Python: "Python handles all memory automatically (garbage collector). In C, you do it by hand.",
      Java: "Java's 'new' is like malloc, but GC calls free for you. C has no GC.",
      JavaScript: "JS garbage-collects everything. C makes you decide when memory is no longer needed.",
    },
    code: `#include <stdio.h>
#include <stdlib.h>

int main(void) {
    // Local (stack) variable — automatic, disappears when function ends
    int x = 42;

    // Heap variable — lives until YOU free it
    int *p = malloc(sizeof(int));
    if (p == NULL) {
        printf("out of memory!\\n");
        return 1;
    }
    *p = 99;
    printf("heap value: %d\\n", *p);  // 99

    free(p);       // give the memory back
    p = NULL;      // don't use freed memory!

    // Allocating an array on the heap
    int n = 5;
    int *scores = malloc(n * sizeof(int));
    if (scores == NULL) return 1;

    for (int i = 0; i < n; i++) {
        scores[i] = (i + 1) * 10;     // 10, 20, 30, 40, 50
    }
    for (int i = 0; i < n; i++) {
        printf("%d ", scores[i]);
    }
    printf("\\n");

    free(scores);   // always free what you malloc

    // What if you forget free?
    // The memory leaks — your program slowly eats more and more RAM.
    // No crash, no error — just a silent bug.

    return 0;
}`,
    seedQuestions: [
      "What happens if you forget to call free()?",
      "Why do we check if malloc returned NULL?",
      "Why set p = NULL after free(p)?",
      "When would you use malloc instead of just declaring a variable?",
    ],
  },

  {
    id: "c-structs",
    lang: "c",
    title: "Structs",
    difficulty: "Core",
    icon: "🏗️",
    description:
      "A struct groups related variables together under one name. It's how you build meaningful data types in C.",
    concepts: [
      "Defining and using structs",
      "Dot (.) vs arrow (->) access",
      "Passing structs to functions",
      "typedef for cleaner names",
    ],
    bridges: {
      Python: "Like a simple class with only fields. No methods — you write regular functions that take the struct.",
      Java: "Like a record or POJO. Same idea, but C has no methods or access modifiers.",
      JavaScript: "Like a plain object { name: ..., age: ... } but with a fixed shape declared up front.",
    },
    code: `#include <stdio.h>
#include <string.h>

typedef struct {
    char name[50];
    int age;
    float grade;
} Student;

// Takes a POINTER to Student — can read but won't copy the whole struct
void print_student(const Student *s) {
    printf("%s, age %d, grade %.1f\\n", s->name, s->age, s->grade);
}

// Takes a POINTER — so it can modify the original
void have_birthday(Student *s) {
    s->age++;
}

int main(void) {
    // Create and initialize
    Student alice;
    strcpy(alice.name, "Alice");
    alice.age = 19;
    alice.grade = 87.5;

    // Shorter way (C99)
    Student bob = { .name = "Bob", .age = 20, .grade = 92.0 };

    print_student(&alice);     // pass address with &
    print_student(&bob);

    have_birthday(&alice);
    printf("After birthday: ");
    print_student(&alice);     // age is now 20

    // Direct access uses dot (.)
    printf("%s's grade: %.1f\\n", bob.name, bob.grade);

    // Pointer access uses arrow (->)
    Student *p = &bob;
    printf("%s's grade: %.1f\\n", p->name, p->grade);  // same thing

    return 0;
}`,
    seedQuestions: [
      "What's the difference between alice.age and p->age?",
      "Why do we pass &alice to the function, not just alice?",
      "What does 'const Student *s' mean — what can't you do?",
      "Why use typedef instead of writing 'struct Student' everywhere?",
    ],
  },
];
