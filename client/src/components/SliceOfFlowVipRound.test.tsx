// @vitest-environment jsdom
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useSliceOfFlowStore } from "@/lib/sliceOfFlowStore";
import { makeVipConfig } from "@/lib/sofEngine/vip";
import SliceOfFlowVipRound from "./SliceOfFlowVipRound";

let root: Root;
let container: HTMLDivElement;
let now = 0;
let hidden = false;
let uuid = 0;
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
  document.querySelector<HTMLButtonElement>(`[data-vip-ticket="${key}"]`)!;
const destination = () =>
  document.querySelector<HTMLButtonElement>("[data-vip-destination]")!;
const flushDialog = async () => {
  await act(async () => {
    vi.advanceTimersByTime(0);
  });
};
const click = async (name: string) => {
  await act(async () => button(name).click());
  await flushDialog();
};
const mount = async (
  difficulty: "easy" | "normal" | "hard" = "normal",
  speed: 1 | 2 | 3 = 1
) => {
  await act(async () =>
    root.render(
      <SliceOfFlowVipRound
        difficulty={difficulty}
        speed={speed}
        onClose={close}
      />
    )
  );
};
const start = async (policy: "fifo" | "expedite" = "fifo") => {
  await click(policy === "fifo" ? "Start FIFO baseline" : "Start VIP/expedite");
  await click("Try first order");
};
const select = async (key = "order-1") => {
  await act(async () => ticket(key).click());
};
const move = async () => {
  await act(async () => destination().click());
  await flushDialog();
};
const guidedMove = async () => {
  await select();
  await move();
};
const running = async () => {
  await start();
  await guidedMove();
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
  document.querySelector<HTMLElement>('[data-testid="vip-results"]')!;
const timer = () =>
  document.querySelector<HTMLElement>('[data-testid="vip-timer"]')!;
const finishAt = async (wallMs: number) => {
  now = wallMs;
  await click("End run");
  await act(async () => {
    vi.runAllTimers();
  });
};
const archiveOptions = (name: string) =>
  Array.from(
    document.querySelector<HTMLSelectElement>(`select[aria-label="${name}"]`)!
      .options
  )
    .map(option => option.value)
    .filter(Boolean);

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

describe("preview pilot VIP round", () => {
  it("SSR is inert and discloses the pilot horizon, real boundaries, policies and existing credit", () => {
    const html = renderToStaticMarkup(
      <SliceOfFlowVipRound difficulty="hard" speed={3} />
    );
    const text = html.replace(/<[^>]*>/g, "");
    expect(text).toContain("Preview pilot");
    expect(text).toContain("Round 3");
    expect(text).toContain("Active clock: 300 simulated seconds");
    expect(text).toContain("100 seconds");
    expect(text).toContain("not a guaranteed workshop duration or outcome");
    expect(text).toContain("Original Round 1/2 presets are unchanged");
    expect(text).toContain("Custom Build remains Normal, Large");
    expect(text).toContain(
      "VIPs can jump the queue, but they cannot create Prep or Oven capacity."
    );
    expect(text).toContain(
      "Try protecting space for urgent work, then compare VIP commitments with normal deliveries."
    );
    expect(text).toContain("Three Small VIPs (Prep 30s / Oven 40s)");
    expect(text).toContain(
      "Ordinary WIP limits: Orders 4 · Prep 2 · Oven 3 · Pizza Box 2."
    );
    expect(text).toContain("Built by Jeff Bourke, MHA, PMP, SAFe RTE");
    expect(text).toContain("Start FIFO baseline");
    expect(text).toContain("Start VIP/expedite");
    expect(html).not.toContain('data-testid="vip-board"');
    expect(html).not.toContain('data-testid="vip-results"');
    expect(html).not.toContain("<input");
  });
  it("mounts no timer before Start, and intervention is disabled until a baseline result exists", async () => {
    await mount();
    expect(vi.getTimerCount()).toBe(0);
    expect(button("Start VIP/expedite").disabled).toBe(true);
    await sample(500000);
    expect(document.querySelector('[data-testid="vip-board"]')).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });
  it("uses authoritative Easy configuration for the next run without starting from settings changes", async () => {
    await mount("hard", 3);
    await selectOption("Next run difficulty", "easy");
    await selectOption("Next run speed", "2");
    const config = makeVipConfig({
      difficulty: "easy",
      variant: "fifo",
      initialSpeed: 2,
      guidedStart: true,
    });
    expect(config.ok).toBe(true);
    expect(container.textContent).toContain(
      "Active clock: 420 simulated seconds"
    );
    expect(container.textContent).toContain("210 seconds");
    expect(vi.getTimerCount()).toBe(0);
    await start();
    expect(timer().textContent).toContain("420 simulated seconds");
    expect(
      document.querySelector('[aria-label="Next run difficulty"]')
    ).toBeNull();
  });
  it("owns instruction and first-normal guide pauses, focuses the first order and highlights its valid destination", async () => {
    await mount();
    await click("Start FIFO baseline");
    expect(document.activeElement).toBe(button("Try first order"));
    expect(document.querySelector('[role="dialog"]')).not.toBeNull();
    expect(button("End run").disabled).toBe(true);
    expect(button("Pause kitchen").disabled).toBe(false);
    await click("Try first order");
    expect(document.activeElement).toBe(ticket());
    expect(container.textContent).toContain(
      "Kitchen paused — first-order guide."
    );
    await sample(100000);
    expect(timer().textContent).toContain("300 simulated seconds");
    await select();
    expect(destination().textContent).toBe("Move selected ticket to Prep");
    expect(destination().disabled).toBe(false);
    expect(
      document.querySelector(".sof-vip-lane-head.sof-lab-prep")?.className
    ).toContain("sof-vip-destination-ready");
    await move();
    expect(container.textContent).toContain("Kitchen running.");
    expect(ticket().dataset.vipStation).toBe("prep");
    expect(destination().disabled).toBe(true);
  });
  it("native buttons keep Enter/Space semantics and selected ArrowRight synchronously moves the retained DOM node", async () => {
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
    const unselectedArrow = new KeyboardEvent("keydown", {
      key: "ArrowRight",
      bubbles: true,
      cancelable: true,
    });
    await act(async () => first.dispatchEvent(unselectedArrow));
    expect(first.dataset.vipStation).toBe("orderQueue");
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
    expect(first.dataset.vipStation).toBe("prep");
    expect(document.activeElement).toBe(first);
    expect(first.getAttribute("aria-pressed")).toBe("true");
    expect(container.textContent).toContain("Wait for Ready");
    const globalSpace = new KeyboardEvent("keydown", {
      key: " ",
      bubbles: true,
      cancelable: true,
    });
    document.dispatchEvent(globalSpace);
    expect(globalSpace.defaultPrevented).toBe(false);
  });
  it("Help Escape returns focus and cannot clear the reachable facilitator Resume control", async () => {
    await mount();
    await running();
    await sample(1000);
    await click("Pause kitchen");
    expect(button("Resume kitchen").disabled).toBe(false);
    expect(button("End run").disabled).toBe(true);
    await act(async () => button("Help").focus());
    await click("Help");
    expect(document.activeElement).toBe(button("Close help"));
    await act(async () => button("Resume kitchen").focus());
    expect(
      document
        .querySelector('[role="dialog"]')
        ?.contains(document.activeElement)
    ).toBe(true);
    await act(async () =>
      document.activeElement?.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true })
      )
    );
    await flushDialog();
    expect(document.activeElement).toBe(button("Help"));
    expect(container.textContent).toContain("Kitchen paused — facilitator.");
    await click("Resume kitchen");
    expect(container.textContent).toContain("Kitchen running.");
  });
  it("hides live score aggregates from the DOM but preserves readiness, deadlines, capacity and burns", async () => {
    await mount();
    await running();
    await click("Hide live scores");
    expect(
      document.querySelector('[data-testid="vip-live-scores"]')
    ).toBeNull();
    expect(container.textContent).not.toContain("Served:");
    expect(container.textContent).not.toContain("Burnt:");
    expect(container.textContent).toContain("Kitchen time remaining:");
    expect(container.textContent).toContain("Occupancy:");
    expect(container.textContent).toContain("Working:");
    expect(container.textContent).toContain("deadline 100s");
    await sample(30000);
    await move();
    expect(container.textContent).toContain("Burn hazard:");
    expect(container.textContent).toContain("Due in 70s");
    await sample(70000);
    await move();
    await move();
    await finishAt(80000);
    expect(result().textContent).toContain("Final canonical VIP score");
    expect(result().textContent).toContain("Normal arrival-to-served mean");
    expect(result().textContent).toContain("Normal Orders-to-served mean");
    expect(result().textContent).toContain(
      "70 simulated seconds · observed served n = 1"
    );
    expect(result().textContent).toContain("0.75 tickets per simulated minute");
  });
  it("renders all canonical final ticket rows with real timestamps, zero admission and served/active/unadmitted identities", async () => {
    await mount();
    await running();
    await click("Pull oldest available ticket (FIFO)");
    await sample(30000);
    await move();
    await sample(70000);
    await move();
    await move();
    await finishAt(80000);
    const rows = Array.from(result().querySelectorAll<HTMLElement>(
      "[data-vip-ticket][data-vip-status]"
    ));
    expect(rows).toHaveLength(15);
    expect(new Set(rows.map(row => row.dataset.vipTicket)).size).toBe(15);
    const first = rows.find(row => row.dataset.vipTicket === "order-1")!;
    expect(first.dataset.vipStatus).toBe("served");
    expect(first.dataset.vipStation).toBe("");
    expect(first.dataset.vipAdmittedAtMs).toBe("0");
    expect(first.dataset.vipExitedAtMs).toBe("70000");
    const second = rows.find(row => row.dataset.vipTicket === "order-2")!;
    expect(second.dataset.vipStatus).toBe("active");
    expect(second.dataset.vipStation).toBe("orderQueue");
    expect(second.dataset.vipAdmittedAtMs).toBe("0");
    expect(second.dataset.vipExitedAtMs).toBe("");
    const vip = rows.find(row => row.dataset.vipTicket === "order-13")!;
    expect(vip.dataset.vipStatus).toBe("not-admitted");
    expect(vip.dataset.vipAdmittedAtMs).toBe("");
    expect(vip.dataset.vipStation).toBe("");
    const disclosure = result().querySelector<HTMLDetailsElement>(
      '[data-testid="vip-final-ticket-records"]'
    )!;
    expect(disclosure.open).toBe(false);
    expect(disclosure.querySelector("summary")?.textContent).toBe("Recorded ticket outcomes");
    expect(disclosure.textContent).toContain("not uploaded");
  });
  it("external VIP arrivals have text statuses and FIFO does not permit jumping older normal backlog", async () => {
    await mount();
    await running();
    expect(container.textContent).toContain("Not yet arrived · arrives in 10s");
    await sample(10000);
    const vip = document.querySelector<HTMLButtonElement>(
      'button[data-vip-admit="order-13"]'
    )!;
    expect(vip.disabled).toBe(true);
    expect(container.textContent).toContain("Pending in external backlog");
    expect(container.textContent).toContain(
      "FIFO requires the oldest available ticket"
    );
    expect(container.textContent).toContain("Next: Normal Order 2");
    await sample(100001);
    expect(container.textContent).toContain("Overdue by 1s");
    expect(container.textContent).not.toContain("caused delay");
  });
  it("final zero-served measurements show N/A rather than zero, observed n and canonical late/pending partitions", async () => {
    await mount();
    await running();
    await finishAt(110000);
    expect(result().textContent).toContain("N/A (no observed samples)");
    expect(result().textContent).toContain("observed served n = 0");
    expect(result().textContent).toContain(
      "On time: 0 · Late: 1 · Pending: 1 · Not yet arrived: 1 · Burnt: 0"
    );
    expect(result().textContent).toContain("Waited during VIP activity");
    expect(result().textContent).toContain("not causal delay");
    expect(button("Start VIP/expedite").disabled).toBe(false);
    const debrief = document.querySelector('[aria-label="Team debrief"]')!;
    expect(debrief.textContent).toContain(
      "Did protecting urgent work help you meet commitments? What happened to normal work and total deliveries?"
    );
    expect(debrief.textContent).toContain(
      "Discuss observed evidence, not an assumed lesson."
    );
    expect(
      document.querySelector<HTMLSelectElement>(
        'select[aria-label="Baseline attempt"]'
      )!.value
    ).toBe("");
    expect(
      document.querySelector<HTMLSelectElement>(
        'select[aria-label="Expedite attempt"]'
      )!.value
    ).toBe("");
  });
  it("expedite uses canonical admission preflight, labels active gold VIPs and limits the global token", async () => {
    await mount();
    await running();
    await finishAt(1000);
    await start("expedite");
    await guidedMove();
    await sample(11000);
    expect(button("Pull earliest VIP into Orders").disabled).toBe(false);
    await click("Pull earliest VIP into Orders");
    expect(ticket("order-13").className).toContain("sof-vip-ticket-gold");
    expect(ticket("order-13").textContent).toContain("VIP Order 13");
    expect(container.textContent).toContain("VIP token occupied by order-13");
    await sample(91000);
    expect(button("Pull earliest VIP into Orders").disabled).toBe(true);
    expect(ticket("order-13").textContent).toContain("Due in 10s");
    expect(container.textContent).toContain("2 physical Prep workers");
    expect(container.textContent).toContain("3 physical oven slots");
  });
  it("shows an occupied VIP exception slot only when real occupancy exceeds the ordinary Orders limit", async () => {
    await mount();
    await running();
    await finishAt(1000);
    await start("expedite");
    await guidedMove();
    for (let index = 0; index < 4; index++)
      await click("Pull next Normal order into Orders");
    expect(document.querySelector(".sof-vip-exception")).toBeNull();
    await sample(11000);
    await click("Pull earliest VIP into Orders");
    expect(document.querySelector(".sof-vip-exception")?.textContent).toContain(
      "actual occupancy 5 exceeds ordinary limit 4"
    );
    expect(button("Pull next Normal order into Orders").disabled).toBe(true);
  });
  it("retains fresh distinct IDs, keeps comparison choices empty, and assesses an explicitly selected manual-end pair as not matched", async () => {
    await mount();
    await running();
    await finishAt(1000);
    const baselineRunId = result().dataset.runId!;
    const baselineText = result().textContent;
    await start("expedite");
    await guidedMove();
    await finishAt(2000);
    const subjectRunId = result().dataset.runId!;
    expect(subjectRunId).not.toBe(baselineRunId);
    expect(result().dataset.variant).toBe("expedite");
    expect(archiveOptions("Baseline attempt")).toEqual([baselineRunId]);
    expect(archiveOptions("Expedite attempt")).toEqual([subjectRunId]);
    expect(
      document.querySelector<HTMLSelectElement>(
        'select[aria-label="Baseline attempt"]'
      )!.value
    ).toBe("");
    expect(
      document.querySelector<HTMLSelectElement>(
        'select[aria-label="Expedite attempt"]'
      )!.value
    ).toBe("");
    await selectOption("Baseline attempt", baselineRunId);
    await selectOption("Expedite attempt", subjectRunId);
    const comparison = document.querySelector(
      '[data-testid="vip-comparison"]'
    )!;
    expect(comparison.textContent).toContain("Not matched");
    expect(comparison.textContent).toContain("Manual ends are not matched");
    expect(comparison.textContent).toContain("not a causal claim");
    await click(`View result ${baselineRunId}`);
    expect(result().textContent).toBe(baselineText);
    await click("Return to current result");
    expect(result().dataset.runId).toBe(subjectRunId);
    await click("Return to results");
    expect(close).toHaveBeenCalledOnce();
  });
  it("grants Matched conditions only through canonical assessment for full horizons with identical owned control traces", async () => {
    await mount();
    await running();
    await sample(300000);
    const baseline = result().dataset.runId!;
    expect(result().dataset.variant).toBe("fifo");
    expect(result().textContent).toContain("300 simulated seconds");
    await start("expedite");
    await guidedMove();
    await sample(600000);
    const subject = result().dataset.runId!;
    await selectOption("Baseline attempt", baseline);
    await selectOption("Expedite attempt", subject);
    const comparison = document.querySelector(
      '[data-testid="vip-comparison"]'
    )!;
    expect(comparison.textContent).toContain("Matched conditions");
    expect(comparison.textContent).toContain("human choices can differ");
    expect(comparison.textContent).toContain("not a causal claim");
  });
  it("separates external arrival-to-served from Orders admission-to-served using actual timestamps", async () => {
    await mount();
    await running();
    await finishAt(1000);
    await start("expedite");
    await guidedMove();
    await sample(11000);
    await click("Pull earliest VIP into Orders");
    await click("Pull next Normal order into Orders");
    await select("order-2");
    await move();
    await sample(41000);
    await move();
    await sample(81000);
    await move();
    await move();
    await finishAt(91000);
    const normalArrival = Array.from(
      result().querySelectorAll("dl > div")
    ).find(row =>
      row.textContent?.startsWith("Normal arrival-to-served mean")
    )!;
    const normalOrders = Array.from(result().querySelectorAll("dl > div")).find(
      row => row.textContent?.startsWith("Normal Orders-to-served mean")
    )!;
    expect(normalArrival.textContent).toContain(
      "80 simulated seconds · observed served n = 1"
    );
    expect(normalOrders.textContent).toContain(
      "70 simulated seconds · observed served n = 1"
    );
    expect(result().textContent).toContain("Waited during VIP activity");
    expect(result().textContent).toContain(
      "measured overlap, not causal delay"
    );
  });
  it("serves a VIP exactly at its external-arrival deadline as on time, without a later deadline penalty", async () => {
    await mount();
    await running();
    await finishAt(1000);
    await start("expedite");
    await guidedMove();
    await sample(11000);
    await click("Pull earliest VIP into Orders");
    await select("order-13");
    await move();
    await sample(41000);
    await move();
    await sample(81000);
    await move();
    await sample(101000);
    expect(ticket("order-13").textContent).toContain("Due now");
    await move();
    await finishAt(102000);
    expect(result().textContent).toContain(
      "On time: 1 · Late: 0 · Pending: 1 · Not yet arrived: 1 · Burnt: 0"
    );
    expect(result().textContent).toContain(
      "90 simulated seconds · observed served n = 1"
    );
    expect(result().textContent).toContain("4 points · 0 deadline penalties");
  });
  it("capacity advice in Help does not auto-reserve Prep: normal work can fill both workers and a VIP remains blocked", async () => {
    await mount();
    await running();
    await finishAt(1000);
    await start("expedite");
    await guidedMove();
    await sample(11000);
    expect(ticket("order-2")).toBeNull();
    expect(ticket("order-13")).toBeNull();
    await click("Pull earliest VIP into Orders");
    await click("Help");
    const help = document.querySelector('[role="dialog"]')!;
    expect(help.textContent).toContain(
      "VIPs can jump the queue, but they cannot create Prep or Oven capacity."
    );
    expect(help.textContent).toContain(
      "Try protecting space for urgent work, then compare VIP commitments with normal deliveries."
    );
    expect(help.textContent).toContain(
      "No extra Prep worker or oven slot is created."
    );
    await click("Close help");
    expect(ticket("order-13").dataset.vipStation).toBe("orderQueue");
    await click("Pull next Normal order into Orders");
    await select("order-2");
    expect(destination().disabled).toBe(false);
    await move();
    expect(ticket("order-2").dataset.vipStation).toBe("prep");
    await select("order-13");
    expect(destination().textContent).toBe("Move selected ticket to Prep");
    expect(destination().disabled).toBe(true);
    expect(container.textContent).toContain("Destination is full");
    expect(
      document.querySelector(".sof-vip-lane-head.sof-lab-prep")?.textContent
    ).toContain("Occupancy: 2 / 2");
    expect(
      document.querySelector(".sof-vip-lane-head.sof-lab-prep")?.className
    ).not.toContain("sof-vip-destination-ready");
    expect(container.textContent).toContain("2 physical Prep workers");
    expect(container.textContent).toContain("3 physical oven slots");
    expect(ticket("order-13").textContent).toContain("Due in 90s");
    expect(container.textContent).toContain("Arrival 10s · deadline 100s");
    expect(container.textContent).toContain("Arrival 90s · deadline 180s");
    expect(container.textContent).toContain("Arrival 170s · deadline 260s");
  });
  it("full observation windows remain not matched when a human's help control trace differs", async () => {
    await mount();
    await running();
    await sample(300000);
    const baseline = result().dataset.runId!;
    await start("expedite");
    await guidedMove();
    await sample(301000);
    await click("Help");
    await click("Close help");
    await sample(600000);
    const subject = result().dataset.runId!;
    await selectOption("Baseline attempt", baseline);
    await selectOption("Expedite attempt", subject);
    const comparison = document.querySelector(
      '[data-testid="vip-comparison"]'
    )!;
    expect(comparison.textContent).toContain("Not matched");
    expect(comparison.textContent).toContain("control trace mismatch");
  });
  it("replaying FIFO preserves multiple selectable results and never silently changes the selected pair", async () => {
    await mount();
    await running();
    await finishAt(1000);
    const firstId = result().dataset.runId!;
    await selectOption("Baseline attempt", firstId);
    await start();
    await guidedMove();
    await finishAt(2000);
    const secondId = result().dataset.runId!;
    expect(archiveOptions("Baseline attempt")).toEqual([firstId, secondId]);
    expect(
      document.querySelector<HTMLSelectElement>(
        'select[aria-label="Baseline attempt"]'
      )!.value
    ).toBe(firstId);
    expect(
      document.querySelector<HTMLSelectElement>(
        'select[aria-label="Expedite attempt"]'
      )!.value
    ).toBe("");
  });
  it("hidden tab flushes visible elapsed and never catches up; other pause owners survive return", async () => {
    await mount();
    await running();
    now = 2000;
    hidden = true;
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange"))
    );
    expect(timer().textContent).toContain("298 simulated seconds");
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
    expect(timer().textContent).toContain("298 simulated seconds");
    expect(container.textContent).toContain("Kitchen paused — facilitator.");
    await click("Resume kitchen");
    await sample(101000);
    expect(timer().textContent).toContain("297 simulated seconds");
    expect(vi.getTimerCount()).toBe(1);
  });
  it("exit cancellation preserves pause ownership and confirmed exit abandons without a new snapshot", async () => {
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
    expect(container.textContent).toContain("Attempt 1 abandoned.");
    expect(document.querySelector('[data-testid="vip-results"]')).toBeNull();
    expect(button("Start VIP/expedite").disabled).toBe(true);
    await act(async () => {
      vi.runAllTimers();
    });
    expect(vi.getTimerCount()).toBe(0);
  });
  it("start while hidden stays hidden-paused after the guide, with no forward hidden clock", async () => {
    hidden = true;
    await mount();
    await start();
    expect(container.textContent).toContain("hidden tab");
    await select();
    expect(destination().disabled).toBe(true);
    await sample(500000);
    expect(timer().textContent).toContain("300 simulated seconds");
    hidden = false;
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange"))
    );
    await guidedMove();
    await sample(501000);
    expect(timer().textContent).toContain("299 simulated seconds");
  });
  it("pagehide abandons and unmount cancels the sole scheduler without touching the old store, fetch or storage", async () => {
    const store = useSliceOfFlowStore.getState();
    const before = JSON.stringify(store);
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const storageWrite = vi.spyOn(Storage.prototype, "setItem");
    await mount();
    await running();
    await sample(1000);
    expect(vi.getTimerCount()).toBe(1);
    await act(async () => window.dispatchEvent(new Event("pagehide")));
    await act(async () => {
      vi.runAllTimers();
    });
    expect(vi.getTimerCount()).toBe(0);
    expect(container.textContent).toContain("Attempt 1 abandoned.");
    expect(document.querySelector('[data-testid="vip-results"]')).toBeNull();
    await act(async () => root.render(null));
    expect(vi.getTimerCount()).toBe(0);
    expect(useSliceOfFlowStore.getState()).toBe(store);
    expect(JSON.stringify(store)).toBe(before);
    expect(fetch).not.toHaveBeenCalled();
    expect(storageWrite).not.toHaveBeenCalled();
  });
  it("redundant visible events do not cancel the sole active scheduler and horizon races capture the actual window", async () => {
    await mount();
    await running();
    await sample(1000);
    await act(async () =>
      document.dispatchEvent(new Event("visibilitychange"))
    );
    await sample(2000);
    expect(timer().textContent).toContain("298 simulated seconds");
    expect(vi.getTimerCount()).toBe(1);
    await finishAt(400000);
    expect(result().textContent).toContain("300 simulated seconds");
    expect(result().textContent).toContain("horizon");
    expect(result().textContent).not.toContain("Manual end");
    expect(vi.getTimerCount()).toBe(0);
  });
});
