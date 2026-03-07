import type { PromptMessage } from "./types";

const ABORT_KEYWORDS = ["aborted", "abort", "cancelled", "canceled"];

export const containsAbortKeyword = (value: string | undefined): boolean => {
  if (!value) {
    return false;
  }
  const normalized = value.toLowerCase();
  return ABORT_KEYWORDS.some((keyword) => normalized.includes(keyword));
};

export const isAbortLikeError = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const maybeError = error as {
    name?: string;
    type?: string;
    message?: string;
  };

  return (
    containsAbortKeyword(maybeError.type) ||
    containsAbortKeyword(maybeError.name) ||
    containsAbortKeyword(maybeError.message)
  );
};

export const isLastAssistantMessageAborted = (
  messages: PromptMessage[]
): boolean => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const info = messages[index]?.info;
    if (!info || info.role !== "assistant") {
      continue;
    }

    if (containsAbortKeyword(info.error?.type)) {
      return true;
    }
    if (containsAbortKeyword(info.error?.name)) {
      return true;
    }
    if (containsAbortKeyword(info.error?.message)) {
      return true;
    }

    return false;
  }

  return false;
};
