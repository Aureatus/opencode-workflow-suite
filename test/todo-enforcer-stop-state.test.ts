import { describe, expect, test } from "bun:test";

import { createStopStateStore } from "../src/todo-enforcer/stop-state";

describe("todo enforcer stop state", () => {
  test("tracks per-session stop flags", () => {
    const stopState = createStopStateStore();

    stopState.setStopped("session-a", true);
    expect(stopState.isStopped("session-a")).toBe(true);
    expect(stopState.isStopped("session-b")).toBe(false);

    stopState.setStopped("session-a", false);
    expect(stopState.isStopped("session-a")).toBe(false);
  });

  test("clear removes state", () => {
    const stopState = createStopStateStore();
    stopState.setStopped("session-a", true);

    stopState.clear("session-a");
    expect(stopState.isStopped("session-a")).toBe(false);
  });
});
