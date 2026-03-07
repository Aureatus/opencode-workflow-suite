import { describe, expect, test } from "bun:test";
import type { Event } from "@opencode-ai/sdk";

import {
  extractMessageRoleFromEvent,
  extractSessionIDFromEvent,
  isPermissionEvent,
} from "../src/workflow-core/event-utils";

describe("workflow event utils", () => {
  test("extracts session ID from top-level properties", () => {
    const event = {
      type: "session.idle",
      properties: {
        sessionID: "session-1",
      },
    } as Event;

    expect(extractSessionIDFromEvent(event)).toBe("session-1");
  });

  test("extracts session ID from nested info", () => {
    const event = {
      type: "message.updated",
      properties: {
        info: {
          sessionID: "session-2",
          role: "assistant",
        },
      },
    } as Event;

    expect(extractSessionIDFromEvent(event)).toBe("session-2");
  });

  test("extracts session ID from info.id fallback", () => {
    const event = {
      type: "message.updated",
      properties: {
        info: {
          id: "session-3",
          role: "assistant",
        },
      },
    } as Event;

    expect(extractSessionIDFromEvent(event)).toBe("session-3");
  });

  test("returns undefined when session ID is missing", () => {
    const event = {
      type: "session.idle",
      properties: {
        status: {
          type: "idle",
        },
      },
    } as unknown as Event;

    expect(extractSessionIDFromEvent(event)).toBeUndefined();
  });

  test("extracts message role from nested info", () => {
    const event = {
      type: "message.updated",
      properties: {
        info: {
          sessionID: "session-4",
          role: "user",
        },
      },
    } as Event;

    expect(extractMessageRoleFromEvent(event)).toBe("user");
  });

  test("returns undefined for missing message role", () => {
    const event = {
      type: "message.updated",
      properties: {
        sessionID: "session-5",
      },
    } as unknown as Event;

    expect(extractMessageRoleFromEvent(event)).toBeUndefined();
  });

  test("matches permission.updated events", () => {
    const event = {
      type: "permission.updated",
      properties: {
        sessionID: "session-6",
      },
    } as Event;

    expect(isPermissionEvent(event)).toBe(true);
  });

  test("matches compatibility permission.asked events", () => {
    const event = {
      type: "permission.asked",
      properties: {
        sessionID: "session-7",
      },
    } as unknown as Event;

    expect(isPermissionEvent(event)).toBe(true);
  });

  test("does not match non-permission events", () => {
    const event = {
      type: "session.idle",
      properties: {
        sessionID: "session-8",
      },
    } as Event;

    expect(isPermissionEvent(event)).toBe(false);
  });
});
