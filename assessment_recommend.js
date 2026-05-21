export const CONCEPT_TO_LESSON = {
  "write() and file descriptors":        { id: "s01-write",          difficulty: 0, title: "write() & File Descriptors" },
  "Strings and the \\0 loop":            { id: "s01-strings",        difficulty: 1, title: "Strings & Null Termination" },
  "Character checks and ASCII math":     { id: "s01-ascii",          difficulty: 0, title: "ASCII & Character Math" },
  "argc/argv and argument handling":     { id: "s01-argc-argv",      difficulty: 2, title: "argc & argv: Command-Line Args" },
  "Logic: swap and in-place modification": { id: "s01-in-place",     difficulty: 2, title: "Swap & In-Place Modification" },
  "Logic: modular arithmetic and state": { id: "s01-control-flow",   difficulty: 0, title: "Control Flow & Loops" },
  "Linked list traversal":               { id: "s01a2-linked-list",  difficulty: 1, title: "Linked Lists" },
  "Recursion":                           { id: "s01a2-recursion",    difficulty: 2, title: "Recursion & Trees" },
  "Static variables and persistent state": { id: "s01a2-static-var", difficulty: 2, title: "Static Variables & State" },
};

export function recommendLesson(answers) {
  const partial = answers
    .filter(a => a.score === 1)
    .map(a => CONCEPT_TO_LESSON[a.concept])
    .filter(Boolean);

  if (partial.length > 0) {
    partial.sort((a, b) => a.difficulty - b.difficulty);
    return partial[0];
  }

  const weak = answers
    .filter(a => a.score === 0 || a.score === null)
    .map(a => CONCEPT_TO_LESSON[a.concept])
    .filter(Boolean);

  if (weak.length > 0) {
    weak.sort((a, b) => a.difficulty - b.difficulty);
    return weak[0];
  }

  const partial2 = answers
    .filter(a => a.score === 2)
    .map(a => CONCEPT_TO_LESSON[a.concept])
    .filter(Boolean);
  if (partial2.length > 0) {
    partial2.sort((a, b) => b.difficulty - a.difficulty);
    return partial2[0];
  }

  return { id: "s01a2-recursion", difficulty: 2, title: "Recursion & Trees" };
}
