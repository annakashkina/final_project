export const meta = { id: "A", title: "C Comprehension — Form A" };

export const questions = [
  {
    id: "a-1",
    concept: "write() and file descriptors",
    code: `#include <unistd.h>

void my_putchar(char c)
{
    write(1, &c, 1);
}

int main()
{
    my_putchar('H');
    my_putchar('i');
    my_putchar('\\n');
    return 0;
}`,
    question: "What does this program output? Why does write() need &c instead of just c?",
  },
  {
    id: "a-2",
    concept: "Strings and the \\0 loop",
    code: `int my_strcmp(char *s1, char *s2)
{
    int i = 0;
    while (s1[i] && s2[i] && s1[i] == s2[i])
        i++;
    return s1[i] - s2[i];
}`,
    question: "This function compares two strings. What does it return when the strings are equal? Why does the loop have three conditions? What would go wrong with only s1[i] == s2[i]?",
  },
  {
    id: "a-3",
    concept: "Character checks and ASCII math",
    code: `int my_is_alpha(char c)
{
    if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z'))
        return 1;
    return 0;
}

char my_tolower(char c)
{
    if (c >= 'A' && c <= 'Z')
        return c + 32;
    return c;
}`,
    question: "Why can we use >= and <= to check if a character is a letter? Why does adding 32 convert uppercase to lowercase?",
  },
  {
    id: "a-4",
    concept: "argc/argv and argument handling",
    code: `#include <stdlib.h>
#include <stdio.h>

// Run as: ./program 4 secret
int main(int argc, char **argv)
{
    if (argc != 3)
        return 1;
    int attempts = atoi(argv[1]);
    char *secret = argv[2];
    printf("You have %d tries to guess: %s\\n",
           attempts, secret);
    return 0;
}`,
    question: "argv[1] is \"4\" — a string. Why do we need atoi() to use it as a number? What happens if the user passes \"hello\" instead of \"4\"?",
  },
  {
    id: "a-5",
    concept: "Logic: swap and in-place modification",
    code: `#include <stdio.h>

void swap(int *a, int *b)
{
    int tmp = *a;
    *a = *b;
    *b = tmp;
}

int main()
{
    int x = 10, y = 20;
    swap(&x, &y);
    printf("%d %d\\n", x, y);
    return 0;
}`,
    question: "What does this print? Why is the temporary variable necessary — what would happen if you just wrote *a = *b; *b = *a; without it? Why does swap take pointers instead of plain ints?",
  },
  {
    id: "a-6",
    concept: "Linked list traversal",
    code: `typedef struct s_node {
    int           value;
    struct s_node *next;
} t_node;

void push_front(t_node **head, int value)
{
    t_node *n = malloc(sizeof(t_node));
    n->value = value;
    n->next = *head;
    *head = n;
}`,
    question: "After calling push_front(&list, 3) then push_front(&list, 2) then push_front(&list, 1) on an empty list, what order are the values in? Why does push_front take t_node **head instead of t_node *head?",
  },
  {
    id: "a-7",
    concept: "Recursion",
    code: `#include <unistd.h>

void print_stars(int n)
{
    if (n <= 0)
        return;
    print_stars(n - 1);
    int i = 0;
    while (i < n)
        write(1, "*", 1), i++;
    write(1, "\\n", 1);
}
// print_stars(3) is called in main`,
    question: "What does this print? Why do smaller rows print first, even though we call print_stars(3)? What would change if you moved the recursive call AFTER the write loop?",
  },
  {
    id: "a-8",
    concept: "Static variables and persistent state",
    code: `void track(int reset)
{
    static int total = 0;
    if (reset)
        total = 0;
    else
        total++;
    printf("%d\\n", total);
}
// called as: track(0); track(0); track(0); track(1); track(0);`,
    question: "What are the five numbers printed? How does 'static' let total survive between calls? What would this print if 'static' were removed?",
  },
];
