import { describe, expect, it } from "vitest";
import { validateSnapshot } from "../sofEngine/runSnapshots";
import {
  makeSupplierConfig,
  measureSupplierResults,
  SUPPLIER_PILOT_TIMING,
} from "../sofEngine/supplier";
import { makeFixedDeckConfig } from "../sofEngine/scenario";
import { makeVipConfig } from "../sofEngine/vip";
import { assessComparison } from "../sofEngine/matchedRuns";
import { type Checked, type Speed } from "../sofEngine/types";
import {
  abandonIndependentSession,
  commandIndependentSession,
  exitConfirmationCommand,
  facilitatorCommand,
  replaySupplierSession,
  sampleIndependentSession,
  sessionToken,
  startSupplierSession,
  visibilityCommand,
  startIndependentSession,
  startVipSession,
  type IndependentSession,
} from "./independentSession";
const value = <T>(r: Checked<T>): T => {
  if (!r.ok) throw new Error(JSON.stringify(r.issues));
  return r.value;
};
const start = (
  variant: "naive" | "managed" = "naive",
  speed: Speed = 1,
  code = "supplierA"
) => value(startSupplierSession({ sessionCode: code, speed, variant }, 0));
const command = (
  s: IndependentSession,
  c: unknown,
  wall = s.driver.lastWallUs ?? 0
) => commandIndependentSession(s, sessionToken(s), wall, c);
function running(variant: "naive" | "managed" = "naive", speed: Speed = 1) {
  let s = start(variant, speed);
  s = command(s, {
    kind: "set-pause",
    reason: "instruction",
    active: false,
  }).state;
  s = command(s, { kind: "move", orderKey: "order-1", to: "prep" }).state;
  return command(s, { kind: "set-pause", reason: "guide", active: false })
    .state;
}
describe("supplier pilot shares only the official independent lifecycle", () => {
  it.each(["naive", "managed"] as const)(
    "starts canonical Normal-only %s under instruction and guide with no manufactured final",
    variant => {
      const s = start(variant, 3);
      expect(s.engine.config).toEqual(
        value(
          makeSupplierConfig({ variant, initialSpeed: 3, guidedStart: true })
        )
      );
      expect(s.engine.config.manifest.difficulty).toBe("normal");
      expect(s.engine.config.manifest.horizonMs).toBe(240000);
      expect(s.engine.config.manifest.orders).toHaveLength(12);
      expect(
        s.engine.config.manifest.orders.every(
          order => order.availableAtMs === 0
        )
      ).toBe(true);
      expect(s.engine.pausedBy).toEqual(["instruction", "guide"]);
      expect(
        s.engine.tickets.filter(ticket => ticket.status === "active")
      ).toHaveLength(1);
      expect(s.engine.nowMs).toBe(0);
      expect(s.snapshot).toBeNull();
      expect(s.archive.runs).toHaveLength(0);
    }
  );
  it("rejects difficulty and generic configuration injection, retaining old exact fixed/VIP behavior", () => {
    for (const extra of [
      { difficulty: "normal" },
      { config: {} },
      { seed: 0 },
      { scenarioId: "supplier" },
      { guidedStart: false },
    ]) {
      expect(
        startSupplierSession(
          {
            sessionCode: "supplier",
            speed: 1,
            variant: "naive",
            ...extra,
          } as never,
          0
        ).ok
      ).toBe(false);
    }
    expect(
      startSupplierSession({ sessionCode: "supplier", speed: 1 } as never, 0).ok
    ).toBe(false);
    expect(
      startSupplierSession(
        { sessionCode: "supplier", speed: 1, variant: "fifo" } as never,
        0
      ).ok
    ).toBe(false);
    expect(
      startSupplierSession(
        { sessionCode: "supplier", speed: 4, variant: "naive" } as never,
        0
      ).ok
    ).toBe(false);
    const fixed = value(
      startIndependentSession(
        { sessionCode: "fixed", difficulty: "normal", speed: 2 },
        0
      )
    );
    expect(fixed.engine.config).toEqual(
      value(
        makeFixedDeckConfig({
          difficulty: "normal",
          policy: "manual-pull",
          initialSpeed: 2,
          guidedStart: true,
          endCondition: "fixed-horizon",
        })
      )
    );
    const vip = value(
      startVipSession(
        { sessionCode: "vip", difficulty: "hard", speed: 3, variant: "fifo" },
        0
      )
    );
    expect(vip.engine.config).toEqual(
      value(
        makeVipConfig({
          difficulty: "hard",
          variant: "fifo",
          initialSpeed: 3,
          guidedStart: true,
        })
      )
    );
    expect(
      startIndependentSession(
        {
          sessionCode: "fixed",
          speed: 1,
          difficulty: "normal",
          variant: "naive",
        } as never,
        0
      ).ok
    ).toBe(false);
  });
  it("first guide admits no other work and requires the sole valid first Orders-to-Prep move", () => {
    let s = start();
    expect(
      command(s, { kind: "move", orderKey: "order-1", to: "prep" }).accepted
    ).toBe(false);
    s = command(s, {
      kind: "set-pause",
      reason: "instruction",
      active: false,
    }).state;
    for (const c of [
      { kind: "admit", orderKey: "order-2" },
      { kind: "speed", speed: 2 },
      { kind: "end", reason: "manual-stop" },
      { kind: "set-pause", reason: "guide", active: false },
    ])
      expect(command(s, c, 50_000_000).state).toBe(s);
    const moved = command(
      s,
      { kind: "move", orderKey: "order-1", to: "prep" },
      50_000_000
    );
    expect(moved.accepted).toBe(true);
    expect(moved.state.engine.nowMs).toBe(0);
    const unlocked = command(
      moved.state,
      { kind: "set-pause", reason: "guide", active: false },
      100_000_000
    ).state;
    expect(
      sampleIndependentSession(unlocked, sessionToken(unlocked), 101_000_000)
        .state.engine.nowMs
    ).toBe(1000);
  });
  it.each([
    "instruction",
    "guide",
    "help",
    "hidden",
    "transition",
    "exit-confirmation",
  ] as const)("facilitator Resume cannot clear %s ownership", owner => {
    let s = owner === "instruction" || owner === "guide" ? start() : running();
    s = command(s, { kind: "set-pause", reason: owner, active: true }).state;
    s = command(s, facilitatorCommand(true)).state;
    s = command(s, facilitatorCommand(false)).state;
    expect(s.engine.pausedBy).toContain(owner);
    expect(
      command(s, { kind: "end", reason: "manual-stop" }, 100_000_000).state
    ).toBe(s);
  });
  it.each([1, 2, 3] as const)(
    "samples active monotonic time and excludes hidden/pause catch-up at %sx",
    speed => {
      let s = running("managed", speed);
      s = command(s, visibilityCommand(true), 2_000_000).state;
      expect(s.engine.nowMs).toBe(2000 * speed);
      s = command(s, facilitatorCommand(true), 50_000_000).state;
      s = command(s, visibilityCommand(false), 80_000_000).state;
      expect(s.engine.pausedBy).toEqual(["facilitator"]);
      expect(s.engine.nowMs).toBe(2000 * speed);
      s = command(s, facilitatorCommand(false), 100_000_000).state;
      expect(
        sampleIndependentSession(s, sessionToken(s), 101_000_000).state.engine
          .nowMs
      ).toBe(3000 * speed);
      expect(sampleIndependentSession(s, sessionToken(s), 1).state).toBe(s);
    }
  );
  it("samples under the old speed, preserves fractional carry, and rolls rejected actions back atomically", () => {
    let s = running();
    s = command(s, { kind: "speed", speed: 3 }, 1_000_500).state;
    expect(s.engine.nowMs).toBe(1000);
    expect(s.driver.remainderUs).toBe(500);
    const rejected = command(
      s,
      { kind: "admit", orderKey: "order-3" },
      4_000_500
    );
    expect(rejected.accepted).toBe(false);
    expect(rejected.state).toBe(s);
    const sampled = sampleIndependentSession(
      s,
      sessionToken(s),
      4_000_500
    ).state;
    expect(sampled.engine.nowMs).toBe(10000);
    expect(sampled.driver.remainderUs).toBe(500);
  });
  it("rejects stale run, attempt, and revision without sampling, commands, or abandonment", () => {
    const s = running();
    for (const token of [
      { ...sessionToken(s), runId: "old:run:1" },
      { ...sessionToken(s), attempt: 0 },
      { ...sessionToken(s), revision: 0 },
    ]) {
      expect(
        commandIndependentSession(
          s,
          token,
          100_000_000,
          facilitatorCommand(true)
        ).state
      ).toBe(s);
      expect(sampleIndependentSession(s, token, 100_000_000).state).toBe(s);
      expect(abandonIndependentSession(s, token, "unmount").state).toBe(s);
    }
  });
  it.each(["naive", "managed"] as const)(
    "captures one real %s horizon even if coincident command is rejected",
    variant => {
      const r = command(
        running(variant),
        { kind: "speed", speed: 2 },
        300_000_000
      );
      expect(r.accepted).toBe(false);
      expect(r.state.status).toBe("final");
      expect(r.state.snapshot?.observation.durationMs).toBe(
        SUPPLIER_PILOT_TIMING.horizonMs
      );
      expect(r.state.snapshot?.endReason).toBe("horizon");
      expect(validateSnapshot(r.state.snapshot).ok).toBe(true);
      expect(r.state.archive.runs).toHaveLength(1);
      expect(
        r.state.engine.events.filter(e => e.kind === "runEnded")
      ).toHaveLength(1);
      expect(value(measureSupplierResults(r.state.snapshot!))).toMatchObject({
        scheduledDisruptionMs: 45000,
        observedDisruptionMs: 45000,
        servedN: 0,
        servedMeanMs: null,
      });
      expect(
        sampleIndependentSession(r.state, sessionToken(r.state), 400_000_000)
          .state
      ).toBe(r.state);
    }
  );
  it("records real manual duration and served-only samples, not hypothetical remaining completion", () => {
    let s = running();
    s = command(
      s,
      { kind: "move", orderKey: "order-1", to: "oven" },
      30_000_000
    ).state;
    s = command(
      s,
      { kind: "move", orderKey: "order-1", to: "boxDeliver" },
      70_000_000
    ).state;
    s = command(
      s,
      { kind: "move", orderKey: "order-1", to: "served" },
      70_000_000
    ).state;
    s = command(s, { kind: "end", reason: "manual-stop" }, 80_000_000).state;
    expect(s.snapshot?.observation.durationMs).toBe(80000);
    expect(value(measureSupplierResults(s.snapshot!))).toMatchObject({
      served: 1,
      servedN: 1,
      servedMeanMs: 70000,
    });
  });
  it("cancel exit preserves other owners; confirm and unmount discard draft without a fabricated final", () => {
    let s = command(running(), facilitatorCommand(true), 1_000_000).state;
    s = command(s, exitConfirmationCommand(true), 10_000_000).state;
    const cancelled = command(
      s,
      exitConfirmationCommand(false),
      20_000_000
    ).state;
    expect(cancelled.engine.pausedBy).toEqual(["facilitator"]);
    expect(cancelled.engine.nowMs).toBe(1000);
    expect(
      abandonIndependentSession(
        cancelled,
        sessionToken(cancelled),
        "confirmed-exit"
      ).accepted
    ).toBe(false);
    for (const [state, reason] of [
      [s, "confirmed-exit"],
      [running(), "unmount"],
    ] as const) {
      const abandoned = abandonIndependentSession(
        state,
        sessionToken(state),
        reason
      ).state;
      expect(abandoned.status).toBe("abandoned");
      expect(abandoned.draft).toBeNull();
      expect(abandoned.snapshot).toBeNull();
      expect(abandoned.archive.runs).toHaveLength(0);
      expect(abandoned.engine.events.some(e => e.kind === "runEnded")).toBe(
        false
      );
    }
  });
  it("retains immutable archives, fresh identities, and exact supplier replay settings", () => {
    const final = command(
      running(),
      { kind: "end", reason: "manual-stop" },
      1000
    ).state;
    const before = JSON.stringify(final.archive);
    expect(
      replaySupplierSession(
        running(),
        { sessionCode: "supplierB", speed: 1, variant: "managed" },
        1000
      ).ok
    ).toBe(false);
    expect(
      replaySupplierSession(
        final,
        { sessionCode: "supplierA", speed: 1, variant: "managed" },
        1000
      ).ok
    ).toBe(false);
    expect(
      replaySupplierSession(
        final,
        {
          sessionCode: "supplierB",
          speed: 1,
          variant: "managed",
          difficulty: "normal",
        } as never,
        1000
      ).ok
    ).toBe(false);
    const fresh = value(
      replaySupplierSession(
        final,
        { sessionCode: "supplierB", speed: 2, variant: "managed" },
        1000
      )
    );
    expect(fresh.attempt).toBe(2);
    expect(fresh.runId).not.toBe(final.runId);
    expect(fresh.engine.tickets[0].orderId).not.toBe(
      final.engine.tickets[0].orderId
    );
    expect(fresh.engine.nowMs).toBe(0);
    expect(fresh.engine.pausedBy).toEqual(["instruction", "guide"]);
    expect(fresh.archive.runs).toHaveLength(1);
    expect(fresh.snapshot).toBeNull();
    expect(JSON.stringify(final.archive)).toBe(before);
    expect(Object.isFrozen(fresh.archive.runs[0].history.events[0])).toBe(true);
    expect(
      commandIndependentSession(
        fresh,
        sessionToken(final),
        2000,
        facilitatorCommand(false)
      ).state
    ).toBe(fresh);
  });
  it("assessComparison alone grants approved policy basis and manual-stop remains unmatched", () => {
    const b = command(
      running("naive"),
      { kind: "end", reason: "manual-stop" },
      40_000_000
    ).state;
    let s = value(
      replaySupplierSession(
        b,
        { sessionCode: "supplierB", speed: 1, variant: "managed" },
        40_000_000
      )
    );
    s = command(s, {
      kind: "set-pause",
      reason: "instruction",
      active: false,
    }).state;
    s = command(s, { kind: "move", orderKey: "order-1", to: "prep" }).state;
    s = command(s, { kind: "set-pause", reason: "guide", active: false }).state;
    s = command(s, { kind: "end", reason: "manual-stop" }, 80_000_000).state;
    const assessment = assessComparison(s.archive, {
      pairId: "supplier-test",
      baselineRunId: b.runId,
      subjectRunId: s.runId,
      requestedBasis: "matched",
      change: {
        dimensionId: b.engine.config.policy.dimensionId,
        version: "v1",
        beforeVariantId: "naive",
        afterVariantId: "managed",
      },
    });
    expect(assessment.kind).toBe("unmatched");
    expect(assessment.issues).toContain("MANUAL_END_NOT_MATCHABLE");
  });
});
