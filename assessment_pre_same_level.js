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
    my_putchar('O');
    my_putchar('K');
    my_putchar('\\n');
    return 0;
}`,
    question: "What does this program output? What does write(1, &c, 1) mean? Why do we use &c instead of just c?",
  },
  {
    id: "a-2",
    concept: "Strings and the \\0 loop",
    code: `#include <stdio.h>

int my_strlen(char *s)
{
    int i = 0;
    while (s[i] != '\\0')
        i++;
    return i;
}

int main()
{
    printf("%d\\n", my_strlen("cat"));
    return 0;
}`,
    question: "What does this print? How does my_strlen know where the string ends? Why does it stop at '\\0'?",
  },
  {
    id: "a-3",
    concept: "Character checks and ASCII math",
    code: `#include <stdio.h>

int letter_index(char c)
{
    if (c >= 'a' && c <= 'z')
        return c - 'a';
    return -1;
}

int main()
{
    printf("%d\\n", letter_index('c'));
    printf("%d\\n", letter_index('a'));
    return 0;
}`,
    question: "What does this print? What does c - 'a' compute? Why does this only work correctly for lowercase letters from 'a' to 'z'?",
  },
  {
    id: "a-4",
    concept: "argc/argv and argument handling",
    code: `#include <unistd.h>
#include <stdio.h>

// Run as: ./program Alice Bob
int main(int argc, char **argv)
{
    if (argc != 3)
    {
        write(2, "Usage: ./program name1 name2\\n", 30);
        return 1;
    }
    printf("%s and %s\\n", argv[1], argv[2]);
    return 0;
}`,
    question: "What does this print when run as ./program Alice Bob? Why do we use argv[1] and argv[2] instead of argv[0]? What is argv[0]? Why does the error message use write(2, ...)?",
  },
  {
    id: "a-5",
    concept: "Logic: in-place modification with a pointer",
    code: `#include <stdio.h>

void add_one(int *n)
{
    *n = *n + 1;
}

int main()
{
    int x = 10;
    add_one(&x);
    printf("%d\\n", x);
    return 0;
}`,
    question: "What does this print? Why does add_one take int *n instead of int n? What does *n = *n + 1 change?",
  },
  {
    id: "a-6",
    concept: "Linked list traversal",
    code: `#include <stdio.h>

typedef struct s_node {
    int           value;
    struct s_node *next;
} t_node;

void print_list(t_node *head)
{
    while (head != NULL)
    {
        printf("%d\\n", head->value);
        head = head->next;
    }
}

// Imagine the list is: 1 -> 2 -> 3 -> NULL
// called as: print_list(list);`,
    question: "What values are printed? How does head = head->next move through the list? Why does the loop stop at NULL?",
  },
  {
    id: "a-7",
    concept: "Recursion",
    code: `#include <stdio.h>

void count_down(int n)
{
    if (n <= 0)
        return;
    printf("%d\\n", n);
    count_down(n - 1);
}

int main()
{
    count_down(3);
    return 0;
}`,
    question: "What does this print? Trace the calls count_down(3), count_down(2), count_down(1). What is the base case and why is it necessary?",
  },
  {
    id: "a-8",
    concept: "Static variables and persistent state",
    code: `#include <stdio.h>

void track(void)
{
    static int total = 0;
    total++;
    printf("%d\\n", total);
}

int main()
{
    track();
    track();
    track();
    return 0;
}`,
    question: "What does this print? How does static let total survive between calls? What would change if static were removed?",
  },
];