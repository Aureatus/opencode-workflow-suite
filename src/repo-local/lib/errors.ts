export class RepoPluginError extends Error {
  code: string;
  details?: string;

  constructor(code: string, message: string, details?: string) {
    super(message);
    this.name = "RepoPluginError";
    this.code = code;
    this.details = details;
  }
}

export function toRepoPluginError(error: unknown): RepoPluginError {
  if (error instanceof RepoPluginError) {
    return error;
  }

  if (error instanceof Error) {
    return new RepoPluginError("INTERNAL_ERROR", error.message);
  }

  return new RepoPluginError(
    "INTERNAL_ERROR",
    "Unknown failure while handling repository operation"
  );
}
