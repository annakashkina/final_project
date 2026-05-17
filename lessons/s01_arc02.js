// Season 01 Arc 02 — Intermediate C

export const recursionTrees = { name: "Recursion & Trees", lessons: [
  {
    id: "s01a2-recursion",
    title: "Recursive Thinking",
    difficulty: "Intermediate",
    icon: "\uD83C\uDF32",
    description: "A function that calls itself. The key: handle the base case, then trust the recursive call handles the rest.",
    concepts: [
      "Base case — when to stop",
      "Recursive case — break the problem into a smaller version of itself",
      "The call stack — each call gets its own local variables",
      "Print before vs after the recursive call changes the order",
    ],
    bridges: {
      Python: "Same concept. C recursion is identical, but you can overflow the stack with deep calls.",
      JavaScript: "Same logic. C has no tail-call optimization by default.",
    },
    files: [{
      name: "recursion.c",
      code: `#include <unistd.h>

void print_stars(int n)
{
    if (n <= 0)
        return;
    print_stars(n - 1);
    int i = 0;
    while (i < n)
    {
        write(1, "*", 1);
        i++;
    }
    write(1, "\\n", 1);
}

int main()
{
    print_stars(4);
    // *
    // **
    // ***
    // ****
    return 0;
}`,
    }],
    seedQuestions: [
      "Why does this print small rows first, even though we call with 4?",
      "What happens if you move write before the recursive call?",
      "How does each call remember its own value of n?",
      "What would happen without the base case?",
    ],
  },
  {
    id: "s01a2-linked-list",
    title: "Linked Lists",
    difficulty: "Core",
    icon: "\uD83D\uDD17",
    description: "A chain of nodes, each pointing to the next. Unlike arrays, you can insert and remove without shifting everything.",
    concepts: [
      "struct node { data; next pointer }",
      "Head pointer — the entry point to the list",
      "Traversal: while (node != NULL) node = node->next",
      "Insert at head: new->next = head; head = new",
    ],
    bridges: {
      Python: "Python lists are arrays underneath. C linked lists are built from structs and pointers.",
      JavaScript: "Like building your own array from scratch — each element knows the next one.",
    },
    files: [{
      name: "linked_list.c",
      code: `#include <stdlib.h>
#include <stdio.h>

typedef struct s_node {
    int           value;
    struct s_node *next;
} t_node;

t_node *new_node(int value)
{
    t_node *n = malloc(sizeof(t_node));
    if (!n)
        return NULL;
    n->value = value;
    n->next = NULL;
    return n;
}

void push_front(t_node **head, int value)
{
    t_node *n = new_node(value);
    n->next = *head;
    *head = n;
}

void print_list(t_node *head)
{
    while (head)
    {
        printf("%d -> ", head->value);
        head = head->next;
    }
    printf("NULL\\n");
}

int main()
{
    t_node *list = NULL;
    push_front(&list, 30);
    push_front(&list, 20);
    push_front(&list, 10);
    print_list(list);
    // 10 -> 20 -> 30 -> NULL
    return 0;
}`,
    }],
    seedQuestions: [
      "Why does push_front take t_node **head (double pointer)?",
      "How would you add a node at the end instead of the front?",
      "How would you free the entire list without leaking memory?",
      "What's the difference between a linked list and an array for insertion?",
    ],
  },
  {
    id: "s01a2-binary-tree",
    title: "Binary Trees",
    difficulty: "Advanced",
    icon: "\uD83C\uDF33",
    description: "Each node has up to two children. Recursion is the natural way to walk a tree — left subtree, then right.",
    concepts: [
      "struct node { data; left; right }",
      "Leaf — a node with no children (left == NULL && right == NULL)",
      "In-order traversal: left, print, right → sorted output for BST",
      "Insert into BST: go left if smaller, right if larger",
    ],
    bridges: {
      Python: "Same structure, but Python uses classes. C uses structs with self-referencing pointers.",
    },
    files: [{
      name: "bst.c",
      code: `#include <stdlib.h>
#include <stdio.h>

typedef struct s_tree {
    int            value;
    struct s_tree  *left;
    struct s_tree  *right;
} t_tree;

t_tree *new_tree_node(int value)
{
    t_tree *n = malloc(sizeof(t_tree));
    if (!n)
        return NULL;
    n->value = value;
    n->left = NULL;
    n->right = NULL;
    return n;
}

t_tree *insert(t_tree *root, int value)
{
    if (!root)
        return new_tree_node(value);
    if (value < root->value)
        root->left = insert(root->left, value);
    else
        root->right = insert(root->right, value);
    return root;
}

void inorder(t_tree *root)
{
    if (!root)
        return;
    inorder(root->left);
    printf("%d ", root->value);
    inorder(root->right);
}

int main()
{
    t_tree *root = NULL;
    root = insert(root, 5);
    insert(root, 3);
    insert(root, 7);
    insert(root, 1);
    insert(root, 4);
    inorder(root);
    // 1 3 4 5 7
    printf("\\n");
    return 0;
}`,
    }],
    seedQuestions: [
      "Why does in-order traversal print sorted output?",
      "What would pre-order (print, left, right) give you?",
      "How does insert know where to put a new value?",
      "How would you find the minimum value in a BST?",
    ],
  },
]};

export const systemsProgramming = { name: "Systems Programming", lessons: [
  {
    id: "s01a2-directory",
    title: "Directories — opendir & readdir",
    difficulty: "Core",
    icon: "\uD83D\uDCC1",
    description: "Reading a directory in C: open it, loop through entries, close it. This is the foundation of My Ls.",
    concepts: [
      "opendir(path) returns a DIR* handle",
      "readdir(dir) returns the next entry, or NULL when done",
      "struct dirent has d_name (the filename)",
      "closedir(dir) when done — like close(fd) for files",
    ],
    bridges: {
      Python: "Like os.listdir() but you get one entry at a time.",
      JavaScript: "Like fs.readdirSync() but as a loop with a handle.",
    },
    files: [{
      name: "listdir.c",
      code: `#include <dirent.h>
#include <stdio.h>

int main(int argc, char **argv)
{
    char *path = argc > 1 ? argv[1] : ".";
    DIR *dir = opendir(path);
    if (!dir)
    {
        perror(path);
        return 1;
    }

    struct dirent *entry;
    while ((entry = readdir(dir)) != NULL)
    {
        // Skip . and ..
        if (entry->d_name[0] == '.')
            continue;
        printf("%s\\n", entry->d_name);
    }

    closedir(dir);
    return 0;
}`,
    }],
    seedQuestions: [
      "Why does readdir return NULL at the end?",
      "Why skip entries starting with '.'?",
      "How would you print files sorted alphabetically?",
      "How is this pattern similar to read() for files?",
    ],
  },
  {
    id: "s01a2-stat",
    title: "File Metadata — stat()",
    difficulty: "Intermediate",
    icon: "\uD83D\uDCCA",
    description: "stat() fills a struct with everything about a file: size, permissions, timestamps, type. Essential for ls -l.",
    concepts: [
      "stat(path, &buf) fills struct stat with file info",
      "st_size — file size in bytes",
      "st_mode — permissions and file type (S_ISDIR, S_ISREG)",
      "st_mtime — last modification time",
    ],
    bridges: {
      Python: "Like os.stat(). Same information, same syscall underneath.",
    },
    files: [{
      name: "fileinfo.c",
      code: `#include <sys/stat.h>
#include <stdio.h>
#include <time.h>

int main(int argc, char **argv)
{
    if (argc < 2)
        return 1;

    struct stat sb;
    if (stat(argv[1], &sb) == -1)
    {
        perror(argv[1]);
        return 1;
    }

    if (S_ISDIR(sb.st_mode))
        printf("type: directory\\n");
    else if (S_ISREG(sb.st_mode))
        printf("type: regular file\\n");

    printf("size: %lld bytes\\n", (long long)sb.st_size);
    printf("modified: %s", ctime(&sb.st_mtime));
    return 0;
}`,
    }],
    seedQuestions: [
      "Why does stat take a pointer to struct stat?",
      "How does S_ISDIR work — what is st_mode really?",
      "How would you combine opendir + stat to build ls -l?",
    ],
  },
  {
    id: "s01a2-static-var",
    title: "Static Variables & Persistent State",
    difficulty: "Intermediate",
    icon: "\uD83D\uDCCC",
    description: "A static local variable survives between function calls. This is the trick behind readline — remembering leftover bytes.",
    concepts: [
      "static int x = 0 — initialized once, keeps its value across calls",
      "Lifetime: exists for the entire program, not just the function call",
      "Scope: still local to the function — not global",
      "Use case: buffering data between calls (like readline's leftover)",
    ],
    bridges: {
      Python: "Python uses default mutable arguments or closures. C uses 'static' keyword.",
      JavaScript: "Like a closure variable that persists. C's static is the same idea, built into the language.",
    },
    files: [{
      name: "static.c",
      code: `#include <stdio.h>

int next_id(void)
{
    static int counter = 0;
    counter++;
    return counter;
}

// Readline-style: buffer persists between calls
#include <unistd.h>
#include <string.h>

char *simple_reader(int fd)
{
    static char buf[1024];
    static int  len = 0;
    int n = read(fd, buf + len, 1024 - len);
    if (n > 0)
        len += n;
    // Find newline, return line, shift buffer...
    // (simplified — real readline is more complex)
    return buf;
}

int main()
{
    printf("%d\\n", next_id()); // 1
    printf("%d\\n", next_id()); // 2
    printf("%d\\n", next_id()); // 3
    return 0;
}`,
    }],
    seedQuestions: [
      "What would happen if counter was not static?",
      "How does static differ from a global variable?",
      "Why is static useful for buffered reading?",
      "What are the downsides of static variables?",
    ],
  },
]};

export const advancedPatterns = { name: "Advanced Patterns", lessons: [
  {
    id: "s01a2-sorting",
    title: "Sorting — Selection & Swap",
    difficulty: "Intermediate",
    icon: "\uD83D\uDD22",
    description: "Selection sort: find the smallest, swap it to the front, repeat. Simple, O(n²), but easy to implement in C.",
    concepts: [
      "Outer loop: position to fill (0, 1, 2, ...)",
      "Inner loop: find the minimum in the remaining elements",
      "Swap: put the minimum in the right position",
      "Works on any array — ints, strings (with strcmp), structs",
    ],
    bridges: {
      Python: "Python has sorted(). In C, you implement the algorithm or use qsort().",
      JavaScript: "JS has .sort(). C makes you write the comparisons and swaps yourself.",
    },
    files: [{
      name: "sort.c",
      code: `#include <stdio.h>

void swap(int *a, int *b)
{
    int tmp = *a;
    *a = *b;
    *b = tmp;
}

void selection_sort(int *arr, int len)
{
    int i = 0;
    while (i < len - 1)
    {
        int min_idx = i;
        int j = i + 1;
        while (j < len)
        {
            if (arr[j] < arr[min_idx])
                min_idx = j;
            j++;
        }
        if (min_idx != i)
            swap(&arr[i], &arr[min_idx]);
        i++;
    }
}

int main()
{
    int nums[] = {64, 25, 12, 22, 11};
    int len = 5;
    selection_sort(nums, len);
    int i = 0;
    while (i < len)
        printf("%d ", nums[i++]);
    printf("\\n");
    // 11 12 22 25 64
    return 0;
}`,
    }],
    seedQuestions: [
      "Why does the outer loop stop at len - 1, not len?",
      "How would you sort strings instead of ints?",
      "What's the time complexity and why?",
      "How would you sort in descending order?",
    ],
  },
  {
    id: "s01a2-binary-io",
    title: "Binary Data & Struct Packing",
    difficulty: "Advanced",
    icon: "\uD83D\uDCE6",
    description: "Reading and writing raw structs to files. This is how tar headers and blockchain blocks work — fixed-size binary records.",
    concepts: [
      "write(fd, &struct, sizeof(struct)) — dump raw bytes",
      "read(fd, &struct, sizeof(struct)) — read them back",
      "Struct padding: compiler may add gaps for alignment",
      "__attribute__((packed)) or manual byte layout for exact control",
    ],
    bridges: {
      Python: "Like struct.pack/unpack. C structs ARE the binary layout (with padding caveats).",
    },
    files: [{
      name: "binary_io.c",
      code: `#include <fcntl.h>
#include <unistd.h>
#include <stdio.h>

typedef struct {
    char name[32];
    int  age;
    int  score;
} record;

int main()
{
    // Write a record
    record r = {"Alice", 25, 98};
    int fd = open("data.bin", O_WRONLY | O_CREAT | O_TRUNC, 0644);
    write(fd, &r, sizeof(record));
    close(fd);

    // Read it back
    record loaded;
    fd = open("data.bin", O_RDONLY);
    read(fd, &loaded, sizeof(record));
    close(fd);

    printf("%s, age %d, score %d\\n",
           loaded.name, loaded.age, loaded.score);
    return 0;
}`,
    }],
    seedQuestions: [
      "Why can we write a whole struct with one write() call?",
      "What problems can struct padding cause for binary files?",
      "How would you read multiple records in a loop?",
      "How does this relate to how tar stores file headers?",
    ],
  },
  {
    id: "s01a2-hashing",
    title: "Hashing Basics",
    difficulty: "Advanced",
    icon: "#\uFE0F\u20E3",
    description: "A hash function turns data into a fixed-size number. Used for hash tables, data integrity (blockchain), and checksums.",
    concepts: [
      "Hash function: input of any size → fixed-size output",
      "Good hash: small input change → big output change",
      "Collision: two inputs with the same hash — unavoidable",
      "Use: hash tables (index = hash % size), checksums, blockchain",
    ],
    bridges: {
      Python: "Like hash() or hashlib. C has no built-in — you implement it.",
      JavaScript: "No built-in hash function. Same concept as crypto.createHash().",
    },
    files: [{
      name: "hash.c",
      code: `#include <stdio.h>

// djb2 — a classic string hash function
unsigned long hash_djb2(char *str)
{
    unsigned long hash = 5381;
    int c;
    while ((c = *str++))
        hash = ((hash << 5) + hash) + c;
    return hash;
}

// Simple hash table lookup pattern
#define TABLE_SIZE 16

int main()
{
    char *keys[] = {"alice", "bob", "charlie"};
    int i = 0;
    while (i < 3)
    {
        unsigned long h = hash_djb2(keys[i]);
        int idx = h % TABLE_SIZE;
        printf("%s -> hash=%lu -> slot=%d\\n",
               keys[i], h, idx);
        i++;
    }
    return 0;
}`,
    }],
    seedQuestions: [
      "Why does hash << 5 + hash work as multiplication by 33?",
      "What happens when two keys land in the same slot?",
      "How would you use this to build a simple hash table?",
      "How does hashing provide data integrity in a blockchain?",
    ],
  },
]};
