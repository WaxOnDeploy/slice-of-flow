// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advanceTo, applyAction, createEngine } from "@/lib/sofEngine/engine";
import { makeVipConfig } from "@/lib/sofEngine/vip";
import type {
  Checked,
  Engine as EngineState,
  EngineCommand,
} from "@/lib/sofEngine/types";
import SliceOfFlowVipWatch from "./SliceOfFlowVipWatch";

const value = <T,>(checked: Checked<T>): T => {
  if (!checked.ok) throw new Error(JSON.stringify(checked.issues));
  return checked.value;
};
const command = (engine: EngineState, incoming: EngineCommand): EngineState => {
  const result = applyAction(engine, incoming);
  if (!result.accepted) throw new Error(JSON.stringify(result.issues));
  return result.state;
};
const time = (engine: EngineState, ms: number) =>
  value(advanceTo(engine, ms)).state;
const admit = (engine: EngineState, ordinal: number) =>
  command(engine, { kind: "admit", orderKey: `order-${ordinal}` });
const discard = (engine: EngineState, ordinal: number) =>
  command(engine, { kind: "discard", orderKey: `order-${ordinal}` });
const move = (
  engine: EngineState,
  ordinal: number,
  to: "prep" | "oven" | "boxDeliver" | "served"
) => command(engine, { kind: "move", orderKey: `order-${ordinal}`, to });
const created = (variant: "fifo" | "expedite" = "fifo", guidedStart = false) =>
  value(
    createEngine(
      "vip-watch-test",
      value(
        makeVipConfig({
          difficulty: "normal",
          variant,
          guidedStart,
          initialSpeed: 1,
        })
      )
    )
  ).state;
const running = (variant: "fifo" | "expedite" = "fifo", guide = false) => {
  let engine = command(created(variant, guide), {
    kind: "set-pause",
    reason: "instruction",
    active: false,
  });
  if (guide) {
    engine = move(engine, 1, "prep");
    engine = command(engine, {
      kind: "set-pause",
      reason: "guide",
      active: false,
    });
  }
  return engine;
};
let root: Root;
let container: HTMLDivElement;
const onAdmit = vi.fn();
const onShowArrivals = vi.fn();
const render = async (engine: EngineState) => {
  await act(async () =>
    root.render(
      <SliceOfFlowVipWatch
        engine={engine}
        onAdmit={onAdmit}
        onShowArrivals={onShowArrivals}
      />
    )
  );
};
const button = (name: string) => {
  const found = Array.from(container.querySelectorAll("button")).find(
    item => item.textContent === name
  );
  if (!found)
    throw new Error(`Missing button ${name}: ${container.textContent}`);
  return found;
};
const live = () => container.querySelector('[role="status"]')!;
beforeEach(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  onAdmit.mockReset();
  onShowArrivals.mockReset();
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

describe("persistent canonical VIP watch", () => {
  it("is inert during SSR and shows scheduled arrival, never an arrived notice or pull", () => {
    const engine = created();
    const before = JSON.stringify(engine);
    const html = renderToStaticMarkup(
      <SliceOfFlowVipWatch
        engine={engine}
        onAdmit={onAdmit}
        onShowArrivals={onShowArrivals}
      />
    );
    expect(html).toContain('class="sof-vip-watch"');
    expect(html).toContain('data-testid="vip-watch"');
    expect(html).toContain("VIP Order 13 is scheduled");
    expect(html).toContain("arrives in 10s");
    expect(html).toContain("Show VIP arrivals");
    expect(html).not.toContain("has arrived");
    expect(html).not.toContain("Pull waiting VIP");
    expect(html).not.toContain("data-vip-admit");
    expect(JSON.stringify(engine)).toBe(before);
    expect(onAdmit).not.toHaveBeenCalled();
    expect(onShowArrivals).not.toHaveBeenCalled();
  });

  it("keeps scheduled countdown frozen during the real first-order guide pause", async () => {
    const guide = command(created("fifo", true), {
      kind: "set-pause",
      reason: "instruction",
      active: false,
    });
    expect(guide.pausedBy).toEqual(["guide"]);
    const later = time(guide, 10000);
    expect(later).toBe(guide);
    await render(later);
    expect(container.textContent).toContain("arrives in 10s");
    expect(container.textContent).toContain("First-order guide paused");
    expect(live().textContent).toBe("");
    expect(container.querySelectorAll("button")).toHaveLength(1);
  });

  it("announces the 10s arrival and counts only older external available normals for FIFO", async () => {
    const engine = time(running("fifo", true), 10000);
    const before = JSON.stringify(engine);
    await render(engine);
    expect(container.querySelector(".sof-vip-watch-notice")?.textContent).toBe(
      "VIP Order 13 has arrived · Due in 90s"
    );
    expect(container.textContent).toContain(
      "11 older available normal orders outside Orders"
    );
    expect(container.textContent).toContain(
      "Waiting outside Orders — no gold kitchen ticket until pulled."
    );
    expect(button("Pull waiting VIP Order 13").disabled).toBe(true);
    expect(
      applyAction(engine, { kind: "admit", orderKey: "order-13" }).issues[0]
        .code
    ).toBe("FIFO");
    expect(container.querySelector("[data-vip-admit]")).toBeNull();
    expect(live().getAttribute("aria-live")).toBe("polite");
    expect(live().getAttribute("aria-atomic")).toBe("true");
    expect(live().textContent).toContain(
      "FIFO: VIPs wait behind older available normal orders."
    );
    expect(JSON.stringify(engine)).toBe(before);
    await act(async () => button("Pull waiting VIP Order 13").click());
    expect(onAdmit).not.toHaveBeenCalled();
  });

  it("decreases FIFO backlog only after actual normal admission and excludes active or closed tickets", async () => {
    let engine = time(running("fifo"), 10000);
    await render(engine);
    expect(container.textContent).toContain("12 older available normal orders");
    engine = admit(engine, 1);
    engine = discard(engine, 1);
    engine = admit(engine, 2);
    await render(engine);
    expect(container.textContent).toContain("10 older available normal orders");
    for (let n = 3; n <= 12; n++) {
      engine = admit(engine, n);
      engine = discard(engine, n);
    }
    await render(engine);
    expect(container.textContent).toContain(
      "no older available normal orders remain"
    );
    expect(button("Pull waiting VIP Order 13").disabled).toBe(false);
  });

  it("uses canonical capacity preflight even after the FIFO normal backlog is exhausted", async () => {
    let engine = time(running(), 10000);
    for (let n = 1; n <= 8; n++) engine = discard(admit(engine, n), n);
    for (let n = 9; n <= 12; n++) engine = admit(engine, n);
    expect(
      applyAction(engine, { kind: "admit", orderKey: "order-13" }).issues[0]
        .code
    ).toBe("CAPACITY");
    await render(engine);
    expect(button("Pull waiting VIP Order 13").disabled).toBe(true);
    expect(container.textContent).toContain("Orders is full");
  });

  it("permits deliberate expedite callback only, with the exact canonical order and no auto admission", async () => {
    const engine = time(running("expedite"), 10000);
    const before = JSON.stringify(engine);
    const focusTarget = document.createElement("button");
    document.body.append(focusTarget);
    focusTarget.focus();
    await render(engine);
    expect(document.activeElement).toBe(focusTarget);
    expect(button("Pull waiting VIP Order 13").disabled).toBe(false);
    expect(container.textContent).toContain("VIP token free");
    expect(onAdmit).not.toHaveBeenCalled();
    await act(async () => button("Pull waiting VIP Order 13").click());
    expect(onAdmit).toHaveBeenCalledOnce();
    expect(onAdmit).toHaveBeenCalledWith(engine.config.manifest.orders[12]);
    expect(JSON.stringify(engine)).toBe(before);
    expect(engine.tickets[12].status).toBe("external");
    await act(async () => button("Show VIP arrivals").click());
    expect(onShowArrivals).toHaveBeenCalledOnce();
    expect(onAdmit).toHaveBeenCalledTimes(1);
    focusTarget.remove();
  });

  it("disables an arrived VIP during an actual help pause without changing its arrival announcement", async () => {
    const runningEngine = time(running("expedite"), 10000);
    await render(runningEngine);
    const announcement = live().textContent;
    const paused = command(runningEngine, {
      kind: "set-pause",
      reason: "help",
      active: true,
    });
    await render(paused);
    expect(button("Pull waiting VIP Order 13").disabled).toBe(true);
    expect(container.textContent).toContain("Kitchen paused");
    expect(live().textContent).toBe(announcement);
  });

  it("prioritizes a second pending VIP while showing the active VIP's ordinal, station and deadline", async () => {
    let engine = admit(time(running("expedite"), 10000), 13);
    engine = time(engine, 90000);
    await render(engine);
    expect(container.querySelector(".sof-vip-watch-notice")?.textContent).toBe(
      "VIP Order 14 has arrived · Due in 90s"
    );
    expect(container.textContent).toContain(
      "VIP token occupied by VIP Order 13"
    );
    expect(container.textContent).toContain(
      "Active VIP Order 13 in Orders · Due in 10s · deadline 100s"
    );
    expect(container.textContent).not.toContain("order-13");
    expect(button("Pull waiting VIP Order 14").disabled).toBe(true);
    expect(container.querySelectorAll("button")).toHaveLength(2);
    engine = discard(engine, 13);
    await render(engine);
    expect(button("Pull waiting VIP Order 14").disabled).toBe(false);
  });

  it("keeps the live region text and DOM unchanged across countdown ticks, admission and closure", async () => {
    let engine = time(running("expedite"), 10000);
    await render(engine);
    const region = live();
    const announcement = region.textContent;
    const mutations: MutationRecord[] = [];
    const observer = new MutationObserver(records =>
      mutations.push(...records)
    );
    observer.observe(region, {
      subtree: true,
      characterData: true,
      childList: true,
    });
    engine = time(engine, 11000);
    await render(engine);
    expect(
      container.querySelector(".sof-vip-watch-notice")?.textContent
    ).toContain("Due in 89s");
    engine = discard(admit(engine, 13), 13);
    await render(engine);
    expect(live()).toBe(region);
    expect(live().textContent).toBe(announcement);
    expect(mutations).toHaveLength(0);
    observer.disconnect();
    await render(time(engine, 90000));
    expect(live().textContent).toContain("VIP Order 14 has arrived.");
    expect(live().textContent).not.toContain("VIP Order 15 has arrived.");
  });

  it("uses exact deadline and overdue boundaries for external VIPs without admitting them", async () => {
    const engine = running("expedite");
    await render(time(engine, 100000));
    expect(
      container.querySelector(".sof-vip-watch-notice")?.textContent
    ).toContain("Due now");
    await render(time(engine, 100001));
    expect(
      container.querySelector(".sof-vip-watch-notice")?.textContent
    ).toContain("Overdue by 1s");
    expect(onAdmit).not.toHaveBeenCalled();
  });

  it("distinguishes terminal VIPs from pending and future scheduled arrivals", async () => {
    let engine = move(admit(time(running("expedite"), 10000), 13), 13, "prep");
    engine = move(time(engine, 40000), 13, "oven");
    engine = move(time(engine, 80000), 13, "boxDeliver");
    engine = move(engine, 13, "served");
    await render(engine);
    expect(
      container.querySelector(".sof-vip-watch-notice")?.textContent
    ).toContain("VIP Order 14 is scheduled · arrives in 10s");
    expect(container.textContent).toContain("VIP Order 13: served");
    expect(container.textContent).not.toContain("Active VIP Order 13");
    expect(container.querySelectorAll("button")).toHaveLength(1);
    expect(live().textContent).toContain("VIP Order 13 has arrived.");
    expect(live().textContent).not.toContain("VIP Order 14 has arrived.");
  });

  it("never offers scheduled arrivals after manual end and canonically disables unresolved arrived pulls at horizon", async () => {
    const endedEarly = command(running(), {
      kind: "end",
      reason: "manual-stop",
    });
    await render(endedEarly);
    expect(container.textContent).toContain(
      "Run ended. VIP Order 13 did not arrive."
    );
    expect(container.textContent).not.toContain("arrives in");
    expect(live().textContent).toBe("");
    const horizon = time(running("expedite"), 300000);
    await render(horizon);
    expect(button("Pull waiting VIP Order 13").disabled).toBe(true);
    expect(container.textContent).toContain("Run ended — no more pulls.");
    expect(live().textContent).toContain("VIP Order 15 has arrived.");
  });
});
