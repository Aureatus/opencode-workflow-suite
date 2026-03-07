import type { Event } from "@opencode-ai/sdk";

export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

export const extractSessionIDFromEvent = (event: Event): string | undefined => {
  if (!isRecord(event.properties)) {
    return undefined;
  }
  const properties = event.properties as Record<string, unknown>;

  const fromProperties = properties.sessionID;
  if (typeof fromProperties === "string") {
    return fromProperties;
  }

  const info = properties.info;
  if (!isRecord(info)) {
    return undefined;
  }

  const fromInfo = info.sessionID ?? info.id;
  return typeof fromInfo === "string" ? fromInfo : undefined;
};

export const extractMessageRoleFromEvent = (
  event: Event
): string | undefined => {
  if (!isRecord(event.properties)) {
    return undefined;
  }
  const properties = event.properties as Record<string, unknown>;

  const info = properties.info;
  if (!isRecord(info)) {
    return undefined;
  }

  return typeof info.role === "string" ? info.role : undefined;
};

export const isPermissionEvent = (event: Event): boolean => {
  return (
    event.type === "permission.updated" ||
    (event as { type?: string }).type === "permission.asked"
  );
};
