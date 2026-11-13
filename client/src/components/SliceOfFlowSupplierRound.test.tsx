// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSliceOfFlowStore } from "@/lib/sliceOfFlowStore";
import SliceOfFlowSupplierRound from "./SliceOfFlowSupplierRound";
let root: Root;
let container: HTMLDivElement;
let now = 0,
  hidden = false,
  uuid = 0;
const close = vi.fn();
const button = (name: string): HTMLButtonElement => {
  const found = Array.from(
    document.querySelectorAll<HTMLButtonElement>("button")
  ).find(element => element.textContent === name);
  if (!found)
    throw new Error(`Missing button: ${name}\n${document.body.textContent}`);
  return found;
};
const ticket = (key = "order-1") =>
  document.querySelector<HTMLButtonElement>(`[data-supplier-ticket="${key}"]`)!;
const destination = () =>
  document.querySelector<HTMLButtonElement>("[data-supplier-destination]")!;
const flush = async () => {
  await act(async () => {
    vi.advanceTimersByTime(0);
  });
};
const click = async (name: string) => {
  await act(async () => button(name).click());
  await flush();
};
const mount = async (speed: 1 | 2 | 3 = 1) => {
  await act(async () =>
    root.render(<SliceOfFlowSupplierRound speed={speed} onClose={close} />)
  );
};
const start = async (variant: "naive" | "managed" = "naive") => {
  await click(
    variant === "naive"
      ? "Start oldest-first baseline"
      : "Start managed sequencing"
  );
  await click("Try the first order");
};
const select = async (key = "order-1") => {
  await act(async () => ticket(key).click());
};
const move = async () => {
  await act(async () => destination().click());
  await flush();
};
const guide = async () => {
  await select();
  await move();
};
const running = async () => {
  await start();
  await guide();
};
const sample = async (wallMs: number) => {
  now = wallMs;
  await act(async () => {
    vi.advanceTimersByTime(100);
  });
};
const selectOption = async (name: string, value: string) => {
  const element = document.querySelector<HTMLSelectElement>(
    `select[aria-label="${name}"]`
  )!;
  await act(async () => {
    element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
};
const result = () =>
  document.querySelector<HTMLElement>('[data-testid="supplier-results"]')!;
const timer = () =>
  document.querySelector<HTMLElement>('[data-testid="supplier-timer"]')!;
const basis = () =>
  document.querySelector<HTMLElement>(
    '[data-testid="supplier-comparison-basis"]'
  )!;
const finish = async (wallMs: number) => {
  now = wallMs;
  await click("End run");
  await act(async () => {
    vi.runAllTimers();
  });
};
beforeEach(() => {
  vi.useFakeTimers();
  now = 0;
  hidden = false;
  uuid = 0;
  close.mockReset();
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.spyOn(crypto, "randomUUID").mockImplementation(
    () => `${String(++uuid).padStart(8, "0")}-1234-1234-1234-123456789abc`
  );
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
describe("Round 4 supplier-only partial pilot", () => {
  it("SSR is inert, intro under 60 words, Normal-only provisional disclosure and no print/export or personal input", () => {
    const html = renderToStaticMarkup(<SliceOfFlowSupplierRound speed={3} />);
    const text = html.replace(/<[^>]*>/g, "");
    expect(text).toContain("Round 4 supplier-only pilot — partial");
    expect(text).toContain("No rework, swarm, or outage is implemented");
    expect(text).toContain("Fixed 12-ticket fixture");
    expect(text).toContain("Normal only");
    expect(text).toContain("240 simulated seconds");
    expect(text).toContain("20–65 simulated seconds (45s provisional)");
    expect(text).toContain("two Prep workers and three oven slots");
    expect(text).toContain("no Round 2 matched claim");
    expect(text).toContain("Local memory only");
    expect(text).toContain("Built by Jeff Bourke");
    expect(html).not.toContain("supplier-board");
    expect(html).not.toContain("supplier-results");
    expect(html).not.toContain("<input");
    expect(text).not.toMatch(/Print|Save PDF|Export|Share results/);
    const intro =
      html
        .match(/<aside[^>]*>(.*?)<\/aside>/)?.[1]
        .replace(/<[^>]*>/g, "")
        .trim() ?? "";
    expect(intro.split(/\s+/).length).toBeLessThanOrEqual(60);
  });
  it("mount and setting changes create no scheduler; managed requires a recorded baseline", async () => {
    await mount(3);
    expect(vi.getTimerCount()).toBe(0);
    expect(button("Start managed sequencing").disabled).toBe(true);
    await selectOption("Next run speed", "2");
    await sample(500000);
    expect(vi.getTimerCount()).toBe(0);
    expect(document.querySelector('[data-testid="supplier-board"]')).toBeNull();
    expect(container.textContent).toContain(
      "Settings apply to the next run only"
    );
    expect(
      document.querySelector('select[aria-label="Next run difficulty"]')
    ).toBeNull();
  });
  it("owned instruction and guide focus the first ticket and only valid guide movement unlocks the clock", async () => {
    await mount();
    await click("Start oldest-first baseline");
    expect(document.activeElement).toBe(button("Try the first order"));
    expect(button("End run").disabled).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    await click("Try the first order");
    expect(document.activeElement).toBe(ticket());
    await sample(100000);
    expect(timer().textContent).toContain("240 simulated seconds");
    await select();
    expect(destination().disabled).toBe(false);
    expect(destination().textContent).toBe("Move selected ticket to Prep");
    expect(
      document.querySelector('[role="region"][aria-label="Prep"]')?.className
    ).toContain("sof-supplier-destination-ready");
    await move();
    expect(ticket().dataset.supplierStation).toBe("prep");
    expect(document.activeElement).toBe(ticket());
    expect(container.textContent).toContain("Kitchen running.");
    expect(vi.getTimerCount()).toBe(1);
  });
  it("native Enter/Space selection and selected ArrowRight retain stable direct-child identity and focus", async () => {
    await mount();
    await start();
    const first = ticket();
    expect(first.tagName).toBe("BUTTON");
    const space = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    first.dispatchEvent(space);
    expect(space.defaultPrevented).toBe(false);
    await act(async () =>
      first.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true,
        })
      )
    );
    expect(first.dataset.supplierStation).toBe("orderQueue");
    await select();
    await act(async () =>
      first.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "ArrowRight",
          bubbles: true,
          cancelable: true,
        })
      )
    );
    expect(ticket()).toBe(first);
    expect(first.dataset.supplierStation).toBe("prep");
    expect(document.activeElement).toBe(first);
    const globalSpace = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(globalSpace);
    expect(globalSpace.defaultPrevented).toBe(false);
  });
  it("Help Escape restores focus without removing facilitator ownership; Resume has no global unlock", async () => {
    await mount();
    await running();
    await sample(1000);
    await click("Pause kitchen");
    await click("Help");
    expect(document.activeElement).toBe(button("Close help"));
    expect(document.querySelector('[role="dialog"]')?.textContent).toContain(
      "already-admitted Orders ticket"
    );
    await act(async () =>
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      )
    );
    await flush();
    expect(document.activeElement).toBe(button("Help"));
    expect(container.textContent).toContain("Kitchen paused — facilitator.");
    expect(button("End run").disabled).toBe(true);
    await click("Resume kitchen");
    expect(container.textContent).toContain("Kitchen running.");
  });
  it("naive waits on the head blocker with WIP intact; supplier watch announces phases only and delivery never moves", async () => {
    await mount();
    await running();
    await click("Pull next order into Orders");
    await select("order-2");
    await move();
    await click("Pull next order into Orders");
    await click("Pull next order into Orders");
    expect(ticket("order-3").dataset.supplierStation).toBe("orderQueue");
    await sample(20000);
    expect(ticket("order-3").textContent).toContain("Waiting on supplier");
    expect(ticket("order-3").textContent).toContain("Owner: Supplier");
    expect(ticket("order-3").textContent).toContain("active simulated age 0s");
    expect(ticket("order-1").textContent).not.toContain("Waiting on supplier");
    const announcement = document.querySelector(
      '[data-testid="supplier-live-status"]'
    )!;
    expect(announcement.textContent).toContain("Shortage active");
    expect(announcement.textContent).not.toContain("remaining");
    expect(timer().closest("[aria-live]")).toBeNull();
    await sample(35000);
    expect(announcement.textContent).toContain("Shortage active");
    expect(ticket("order-3").textContent).toContain("active simulated age 15s");
    await select("order-1");
    await move();
    await select("order-2");
    await move();
    await select("order-4");
    expect(destination().disabled).toBe(true);
    expect(container.textContent).toContain(
      "Oldest-first requires the oldest active ticket in Orders"
    );
    expect(
      document.querySelector('[role="region"][aria-label="Orders"]')
        ?.textContent
    ).toContain("Occupancy: 2 / 4");
    expect(
      document.querySelector('[role="region"][aria-label="Prep"]')?.textContent
    ).toContain("Occupancy: 0 / 2");
    await select("order-3");
    expect(destination().disabled).toBe(true);
    await sample(65000);
    expect(announcement.textContent).toContain("Delivery received");
    expect(ticket("order-3").dataset.supplierStation).toBe("orderQueue");
    expect(ticket("order-3").textContent).not.toContain("Waiting on supplier");
    expect(destination().disabled).toBe(false);
    expect(document.activeElement).not.toBe(announcement);
    expect(ticket("order-5")).toBeNull();
  });
  it("managed bypasses only already-admitted unblocked Orders while blocked WIP remains and no capacity appears", async () => {
    await mount();
    await running();
    await finish(1000);
    await start("managed");
    await guide();
    await click("Pull next order into Orders");
    await select("order-2");
    await move();
    await click("Pull next order into Orders");
    await click("Pull next order into Orders");
    await sample(36000);
    await select("order-1");
    await move();
    await select("order-2");
    await move();
    await select("order-4");
    expect(destination().disabled).toBe(false);
    await move();
    expect(ticket("order-4").dataset.supplierStation).toBe("prep");
    expect(ticket("order-3").dataset.supplierStation).toBe("orderQueue");
    expect(ticket("order-3").textContent).toContain("Waiting on supplier");
    expect(ticket("order-5")).toBeNull();
    expect(
      document.querySelector('[role="region"][aria-label="Orders"]')
        ?.textContent
    ).toContain("Occupancy: 1 / 4");
    expect(container.textContent).toContain("2 physical Prep workers");
    expect(container.textContent).toContain("3 physical oven slots");
    await select("order-3");
    expect(destination().disabled).toBe(true);
  });
  it("live-score hiding leaves supplier visibility, readiness, capacities, clock and burn hazards", async () => {
    await mount();
    await running();
    await click("Hide live scores");
    expect(
      document.querySelector('[data-testid="supplier-live-scores"]')
    ).toBeNull();
    expect(container.textContent).not.toContain("Served:");
    expect(container.textContent).toContain("Supplier watch");
    expect(container.textContent).toContain("Occupancy:");
    expect(container.textContent).toContain("Working:");
    await sample(30000);
    await move();
    expect(ticket().textContent).toContain("Burn hazard:");
  });
  it("manual result reports scheduled/observed union and served-only n/a; baseline gates managed and comparisons start empty", async () => {
    await mount();
    await running();
    await click("Pull next order into Orders");
    await click("Pull next order into Orders");
    await finish(40000);
    const text = result().textContent;
    expect(text).toContain("Manual end — not matched");
    expect(text).toContain("45 simulated seconds / 20 simulated seconds");
    expect(text).toContain("20 ticket-seconds · 1 affected tickets");
    expect(text).not.toContain("20 simulated seconds · 1 affected tickets");
    expect(text).toContain("N/A (no observed samples)");
    expect(text).toContain("observed served n = 0");
    expect(text).toContain("Unfinished means active WIP");
    expect(text).toContain("Not admitted");
    expect(button("Start managed sequencing").disabled).toBe(false);
    expect(
      document.querySelector<HTMLSelectElement>(
        '[aria-label="Baseline attempt"]'
      )?.value
    ).toBe("");
    expect(
      document.querySelector<HTMLSelectElement>(
        '[aria-label="Comparison attempt (managed)"]'
      )?.value
    ).toBe("");
    expect(basis().textContent).toContain("Comparison not selected");
    expect(container.textContent).toContain("real ingredient equivalent");
  });
  it("real served sample is Orders-to-served with n and immutable local result IDs, not inferred savings", async () => {
    await mount();
    await running();
    await sample(30000);
    await move();
    await sample(70000);
    await move();
    await move();
    await finish(80000);
    expect(result().textContent).toContain(
      "70 simulated seconds · observed served n = 1"
    );
    const baseline = result().dataset.runId!;
    const before = result().textContent;
    await start("managed");
    await guide();
    await finish(120000);
    const subject = result().dataset.runId!;
    expect(subject).not.toBe(baseline);
    expect(result().dataset.variant).toBe("managed");
    await selectOption("Baseline attempt", baseline);
    await selectOption("Comparison attempt (managed)", subject);
    expect(basis().textContent).toContain("Basis: unmatched");
    expect(basis().textContent).toContain("manual end not matchable");
    expect(container.textContent).toContain("not a causal claim");
    expect(container.textContent).toContain("better, worse, mixed, or equal");
    await click(`View result ${baseline}`);
    expect(result().textContent).toBe(before);
    await click("Return to current result");
    expect(result().dataset.runId).toBe(subject);
  });
  it("full identical horizons get matched only through assessComparison; divergent help trace is not matched", async () => {
    await mount();
    await running();
    await sample(240000);
    const baseline = result().dataset.runId!;
    await start("managed");
    await guide();
    await sample(480000);
    const subject = result().dataset.runId!;
    await selectOption("Baseline attempt", baseline);
    await selectOption("Comparison attempt (managed)", subject);
    expect(basis().textContent).toContain("Matched conditions");
    expect(basis().textContent).toContain("Basis: matched");
    expect(container.textContent).toContain("human choices can differ");
    await start("managed");
    await guide();
    await sample(481000);
    await click("Help");
    await click("Close help");
    await sample(720000);
    await selectOption("Comparison attempt (managed)", result().dataset.runId!);
    expect(basis().textContent).toContain("Basis: unmatched");
    expect(basis().textContent).toContain("control trace mismatch");
  });
  it("hidden tab flushes visible time, preserves facilitator owner and never catches up; redundant visible events retain one scheduler", async () => {
    await mount();
    await running();
    now = 2000;
    hidden = true;
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange"))
    );
    expect(timer().textContent).toContain("238 simulated seconds");
    await act(async () => {
      vi.runAllTimers();
    });
    expect(vi.getTimerCount()).toBe(0);
    await click("Pause kitchen");
    now = 100000;
    hidden = false;
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange"))
    );
    expect(timer().textContent).toContain("238 simulated seconds");
    expect(container.textContent).toContain("facilitator");
    await click("Resume kitchen");
    await sample(101000);
    expect(timer().textContent).toContain("237 simulated seconds");
    expect(vi.getTimerCount()).toBe(1);
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange"))
    );
    await sample(102000);
    expect(timer().textContent).toContain("236 simulated seconds");
    expect(vi.getTimerCount()).toBe(1);
  });
  it("start while hidden retains hidden ownership after instructions, with no clock or guide mutation", async () => {
    hidden = true;
    await mount();
    await start();
    await select();
    expect(destination().disabled).toBe(true);
    await sample(500000);
    expect(timer().textContent).toContain("240 simulated seconds");
    hidden = false;
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange"))
    );
    await guide();
    await sample(501000);
    expect(timer().textContent).toContain("239 simulated seconds");
  });
  it("exit cancel retains ownership and confirmed abandon makes no final snapshot", async () => {
    await mount();
    await running();
    await click("Pause kitchen");
    await click("Leave kitchen");
    await click("Cancel exit");
    expect(document.activeElement).toBe(button("Leave kitchen"));
    expect(container.textContent).toContain("Kitchen paused — facilitator.");
    await click("Leave kitchen");
    await click("Abandon run and exit");
    expect(close).toHaveBeenCalledOnce();
    expect(container.textContent).toContain("Attempt 1 abandoned");
    expect(result()).toBeNull();
    expect(button("Start managed sequencing").disabled).toBe(true);
    await act(async () => {
      vi.runAllTimers();
    });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("pagehide and unmount cancel scheduler without released-store mutation, storage, sounds or network", async () => {
    const store = useSliceOfFlowStore.getState(),
      before = JSON.stringify(store);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const storage = vi.spyOn(Storage.prototype, "setItem");
    await mount();
    await running();
    await sample(1000);
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => window.dispatchEvent(new Event("pagehide")));
    await act(async () => {
      vi.runAllTimers();
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(result()).toBeNull();
    await act(async () => root.render(null));
    expect(vi.getTimerCount()).toBe(0);
    expect(useSliceOfFlowStore.getState()).toBe(store);
    expect(JSON.stringify(store)).toBe(before);
    expect(fetch).not.toHaveBeenCalled();
    expect(storage).not.toHaveBeenCalled();
  });
  it("coincident End run after horizon captures actual horizon once, never a fabricated manual end", async () => {
    await mount();
    await running();
    await finish(400000);
    expect(result().textContent).toContain("240 simulated seconds");
    expect(result().textContent).not.toContain("Manual end");
    expect(vi.getTimerCount()).toBe(0);
  });
});
