export const meta = { id: "B", title: "C Comprehension — Form B" };

export const questions = [
  {
    id: "b-1",
    concept: "write() and file descriptors",
    code: `#include <unistd.h>

void my_put_nbr(int n)
{
    if (n >= 10)
        my_put_nbr(n / 10);
    char c = '0' + (n % 10);
    write(1, &c, 1);
}

int main()
{
    my_put_nbr(42);
    write(1, "\\n", 1);
    return 0;
}`,
    question: "What does this print? Walk through the recursion: why does it print '4' before '2', even though n % 10 gives the last digit?",
  },
  {
    id: "b-2",
    concept: "Strings and the \\0 loop",
    code: `#include <unistd.h>

void my_putstr(char *s)
{
    int i = 0;
    while (s[i] != '\\0')
    {
        write(1, &s[i], 1);
        i++;
    }
}
// called as: my_putstr("hello");`,
    question: "How does this function know where the string ends? What would happen if the string had no '\\0' at the end?",
  },
  {
    id: "b-3",
    concept: "Character checks and ASCII math",
    code: `void count_digits(char *s)
{
    int freq[10] = {0};
    int i = 0;
    while (s[i])
    {
        if (s[i] >= '0' && s[i] <= '9')
            freq[s[i] - '0']++;
        i++;
    }
    for (int d = 0; d < 10; d++)
        if (freq[d] > 0)
            printf("%d appears %d times\\n", d, freq[d]);
}`,
    question: "What does s[i] - '0' compute, and why is it used as an array index? Why does this only work for digit characters?",
  },
  {
    id: "b-4",
    concept: "argc/argv and argument handling",
    code: `// Run as: ./my_cat file1.txt file2.txt
int main(int argc, char **argv)
{
    if (argc < 2)
    {
        write(2, "Usage: ./my_cat file\\n", 21);
        return 1;
    }
    int i = 1;
    while (i < argc)
    {
        printf("%s\\n", argv[i++]);
    }
    return 0;
}`,
    question: "Why does the loop start at i = 1 instead of 0? What is argv[0]? Why does the error message use write(2, ...) instead of write(1, ...)?",
  },
  {
    id: "b-5",
    concept: "Logic: modular arithmetic and state",
    code: `// 0=North 1=East 2=South 3=West
int dir = 0, x = 0, y = 0;
int dx[] = { 0, 1, 0, -1};
int dy[] = {-1, 0, 1,  0};
char *cmds = "RRRA";

int i = 0;
while (cmds[i])
{
    if (cmds[i] == 'R')
        dir = (dir + 1) % 4;
    else if (cmds[i] == 'A')
        x += dx[dir], y += dy[dir];
    i++;
}
printf("%d %d %d\\n", x, y, dir);`,
    question: "What does this print? Walk through each command. Why does (dir + 1) % 4 wrap direction 3 back to 0? How do the dx/dy arrays eliminate the need for if/else per direction?",
  },
  {
    id: "b-6",
    concept: "Linked list traversal",
    code: `typedef struct s_node {
    int           value;
    struct s_node *next;
} t_node;

int list_size(t_node *head)
{
    int count = 0;
    while (head != NULL)
    {
        count++;
        head = head->next;
    }
    return count;
}`,
    question: "How does this function count the nodes? Why can we change 'head' inside the function without affecting the original list outside?",
  },
  {
    id: "b-7",
    concept: "Recursion",
    code: `#include <stdio.h>

int sum_to(int n)
{
    if (n <= 0)
        return 0;
    return n + sum_to(n - 1);
}

int main()
{
    printf("%d\\n", sum_to(4));
    return 0;
}`,
    question: "What does this print? Trace the calls: what does sum_to(4) expand to? What is the base case and why is it necessary?",
  },
  {
    id: "b-8",
    concept: "Static variables and persistent state",
    code: `#include <stdio.h>

int next_id(void)
{
    static int counter = 0;
    counter++;
    return counter;
}

int main()
{
    printf("%d\\n", next_id());
    printf("%d\\n", next_id());
    printf("%d\\n", next_id());
    return 0;
}`,
    question: "What does this print? What would change if 'static' were removed? Why is static useful for a function that needs to remember something between calls?",
  },
];
