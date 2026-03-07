const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

export const unwrapSdkResponse = <T>(value: unknown, fallback: T): T => {
  if (!isRecord(value)) {
    return fallback;
  }

  const data = value.data;
  if (data === undefined) {
    return fallback;
  }

  return data as T;
};
