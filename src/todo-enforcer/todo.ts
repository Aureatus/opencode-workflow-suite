import type { Todo } from "@opencode-ai/sdk";

const TERMINAL_STATUSES = new Set(["completed", "cancelled"]);

export const getIncompleteTodoCount = (todos: Todo[]): number => {
  let count = 0;
  for (const todo of todos) {
    if (!TERMINAL_STATUSES.has(todo.status)) {
      count += 1;
    }
  }
  return count;
};
