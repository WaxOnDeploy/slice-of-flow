import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import SliceOfFlowDialog from "./SliceOfFlowDialog";
import SliceOfFlowAuthorCredit from "./SliceOfFlowAuthorCredit";
import SliceOfFlowOrderGuide from "./SliceOfFlowOrderGuide";
import {
  abandonIndependentSession,
  commandIndependentSession,
  exitConfirmationCommand,
  facilitatorCommand,
  integerWallUs,
  replaySupplierSession,
  sampleIndependentSession,
  sessionToken,
  startSupplierSession,
  visibilityCommand,
  type IndependentSession,
} from "@/lib/sof/independentSession";
import { applyAction } from "@/lib/sofEngine/engine";
import { assessComparison, type PairSpec } from "@/lib/sofEngine/matchedRuns";
import {
  makeSupplierConfig,
  measureSupplierResults,
  readSupplierBlock,
  SUPPLIER_PILOT_TIMING,
  SUPPLIER_VERSIONS,
  type SupplierVariant,
} from "@/lib/sofEngine/supplier";
import {
  STATIONS,
  type DemandOrder,
  type EngineCommand,
  type FinalRunSnapshot,
  type Speed,
  type Station,
} from "@/lib/sofEngine/types";
import "@/lib/sliceOfFlowIndependentLab.css";
import "@/lib/sliceOfFlowSupplier.css";

export interface SliceOfFlowSupplierRoundProps {
  speed: Speed;
  onClose?: () => void;
}
const STATION_NAMES: Record<Station, string> = {
  orderQueue: "Orders",
  prep: "Prep",
  oven: "Oven",
  boxDeliver: "Pizza Box",
};
const TYPE_NAMES: Record<string, string> = {
  cheese: "Cheese",
  pepperoni: "Pepperoni",
  "veggie-supreme": "Veggie Supreme",
  "meat-lovers": "Meat Lovers",
  "custom-build": "Custom Build",
};
const POLICY_NAMES = {
  naive: "Oldest-first baseline",
  managed: "Managed sequencing",
};
const PAUSE_NAMES = {
  instruction: "instructions",
  guide: "first-order guide",
  help: "help",
  facilitator: "facilitator",
  transition: "transition",
  "exit-confirmation": "exit confirmation",
  hidden: "hidden tab",
};
const DISCLAIMER =
  "Matched conditions are not a causal claim: human choices can differ. Managed sequencing may be better, worse, mixed, or equal. One pair is not an outcome distribution or a guaranteed win; no savings are inferred.";
const POLICY_COPY =
  "Both policies pull external tickets FIFO. Oldest-first moves only the oldest active ticket in Orders into Prep and waits if that head is blocked. Managed sequencing may choose any unblocked, already-admitted Orders ticket; blocked tickets keep their WIP slot. Neither policy creates capacity or automatically pulls, moves, or reserves tickets.";
const format = (value: number | null, unit = "") =>
  value === null
    ? "N/A (no observed samples)"
    : `${value.toFixed(2).replace(/\.00$/, "")}${unit}`;
const seconds = (ms: number | null) =>
  format(ms === null ? null : ms / 1000, " simulated seconds");
const byArrival = (a: DemandOrder, b: DemandOrder) =>
  a.availableAtMs - b.availableAtMs ||
  a.ordinal - b.ordinal ||
  a.orderKey.localeCompare(b.orderKey);
function feedback(code: string): string {
  const messages: Record<string, string> = {
    PAUSED:
      "Kitchen paused. Close the owning dialog; Resume kitchen removes only the facilitator pause.",
    CAPACITY:
      "Destination is full. Move a ready ticket out, then try again. No extra capacity is available.",
    NOT_READY: "Wait for Ready before moving this ticket.",
    FIFO: "Pull the oldest external ticket first. Both policies use external FIFO.",
    SUPPLIER_SEQUENCE:
      "Oldest-first requires the oldest active ticket in Orders for Prep. If that head is waiting on supplier, wait for delivery; later Orders tickets cannot bypass it.",
    SUPPLIER_BLOCKED:
      "Waiting on supplier. This unstarted ticket retains its Orders WIP slot until delivery; delivery does not move it.",
    BLOCKED:
      "Waiting on supplier. Delivery unlocks a permitted manual move, never an automatic move.",
    NOT_AVAILABLE: "This order is not available to pull.",
    NOT_ACTIVE: "Select an active ticket.",
    INVALID_MOVE: "Move only to the next station.",
    STALE_SESSION: "The run changed. Try again.",
    ENDED:
      "The observation horizon was reached. The actual final result is recorded.",
  };
  return messages[code] ?? `Action not accepted (${code}). No move was made.`;
}
/** Direct keyed ticket children never change parent when their station changes. */
function gridPosition(
  station: number,
  row: number,
  laneHeight: number
): CSSProperties {
  return {
    "--supplier-col-wide": station + 1,
    "--supplier-row-wide": row + 1,
    "--supplier-col-medium": (station % 2) + 1,
    "--supplier-row-medium": Math.floor(station / 2) * laneHeight + row + 1,
    "--supplier-row-small": station * laneHeight + row + 1,
  } as CSSProperties;
}
function SupplierResult({ snapshot }: { snapshot: FinalRunSnapshot }) {
  const checked = measureSupplierResults(snapshot);
  if (!checked.ok)
    return (
      <section className="sof-lab-final" data-testid="supplier-results">
        <h3>Result unavailable</h3>
        <p>
          Canonical validation rejected this result:{" "}
          {checked.issues.map(issue => issue.code).join(", ")}.
        </p>
      </section>
    );
  const result = checked.value;
  return (
    <section
      className="sof-lab-final sof-supplier-result"
      data-testid="supplier-results"
      data-run-id={snapshot.runId}
      data-variant={snapshot.config.policy.variantId}
      aria-label="Actual supplier pilot run measurements"
    >
      <h3>
        {snapshot.config.policy.variantId === "naive"
          ? POLICY_NAMES.naive
          : POLICY_NAMES.managed}{" "}
        result
      </h3>
      <p>
        Retained run ID: <code>{snapshot.runId}</code>
      </p>
      <p>
        Actual observation: {seconds(snapshot.observation.durationMs)} ·{" "}
        {snapshot.endReason === "manual-stop"
          ? "Manual end — not matched"
          : snapshot.endReason}{" "}
        · complete engine-boundary ledger.
      </p>
      <dl>
        <div>
          <dt>Supplier disruption: scheduled / observed</dt>
          <dd>
            {seconds(result.scheduledDisruptionMs)} /{" "}
            {seconds(result.observedDisruptionMs)}
          </dd>
        </div>
        <div>
          <dt>Blocked ticket time (union per ticket, total)</dt>
          <dd>
            {format(result.ticketBlockedMs / 1000, " ticket-seconds")} ·{" "}
            {result.affectedTicketCount} affected tickets
          </dd>
        </div>
        <div>
          <dt>Served</dt>
          <dd>{result.served}</dd>
        </div>
        <div>
          <dt>Orders-to-served mean (served only)</dt>
          <dd>
            {seconds(result.servedMeanMs)} · observed served n ={" "}
            {result.servedN}
          </dd>
        </div>
        <div>
          <dt>Unfinished active WIP / burnt / angry</dt>
          <dd>
            {result.unfinished} / {result.burnt} / {result.angry}
          </dd>
        </div>
        <div>
          <dt>Not admitted (outside active WIP)</dt>
          <dd>
            {
              snapshot.orders.filter(row => row.outcome === "not-admitted")
                .length
            }
          </dd>
        </div>
        <div>
          <dt>Canonical score</dt>
          <dd>{result.score} points</dd>
        </div>
      </dl>
      <p>
        Scheduled disruption is the full provisional window; observed disruption
        is its overlap with this run's actual observation. Blocked time sums
        each ticket's union of supplier-block intervals, counting overlapping
        intervals once per ticket. Only positive blocked time counts toward
        affected tickets.
      </p>
      <p>
        Orders-to-served starts at admission into Orders, excludes external
        waiting, and uses only actual served samples. Zero samples are N/A, not
        zero. Unfinished means active WIP; unadmitted tickets are shown
        separately. No hypothetical completion or supplier-caused savings are
        calculated.
      </p>
      <details>
        <summary>Recorded ticket outcomes</summary>
        <p>
          Read-only engine records. Times are simulated seconds; these records
          are not uploaded.
        </p>
        <ol>
          {snapshot.orders.map(row => (
            <li
              key={row.orderKey}
              data-supplier-record={row.orderKey}
              data-supplier-status={row.outcome}
            >
              <strong>{row.orderKey}</strong>: {row.outcome}
              {row.finalStation
                ? ` in ${STATION_NAMES[row.finalStation]}`
                : ""}{" "}
              ·{" "}
              {row.admittedAtMs === null
                ? "not admitted"
                : `Orders admission ${seconds(row.admittedAtMs)}`}
              {row.exitedAtMs === null
                ? ""
                : ` · closed ${seconds(row.exitedAtMs)}`}
            </li>
          ))}
        </ol>
      </details>
    </section>
  );
}
function SupplierComparison({
  baseline,
  subject,
}: {
  baseline: FinalRunSnapshot;
  subject: FinalRunSnapshot;
}) {
  const b = measureSupplierResults(baseline),
    s = measureSupplierResults(subject);
  if (!b.ok || !s.ok)
    return (
      <p>
        Selected measurements unavailable; no outcome comparison calculated.
      </p>
    );
  const rows: {
    label: string;
    before: number | null;
    after: number | null;
    lower: boolean;
    time?: boolean;
    ticketTime?: boolean;
  }[] = [
    {
      label: "Served",
      before: b.value.served,
      after: s.value.served,
      lower: false,
    },
    {
      label: "Orders-to-served mean (served only)",
      before: b.value.servedMeanMs,
      after: s.value.servedMeanMs,
      lower: true,
      time: true,
    },
    {
      label: "Blocked ticket time",
      before: b.value.ticketBlockedMs,
      after: s.value.ticketBlockedMs,
      lower: true,
      ticketTime: true,
    },
    {
      label: "Unfinished active WIP",
      before: b.value.unfinished,
      after: s.value.unfinished,
      lower: true,
    },
    {
      label: "Burnt",
      before: b.value.burnt,
      after: s.value.burnt,
      lower: true,
    },
    {
      label: "Angry",
      before: b.value.angry,
      after: s.value.angry,
      lower: true,
    },
    {
      label: "Score",
      before: b.value.score,
      after: s.value.score,
      lower: false,
    },
  ];
  const directions = rows.flatMap(row =>
    row.before === null || row.after === null || row.before === row.after
      ? []
      : [row.after > row.before !== row.lower ? "better" : "worse"]
  );
  const outcome =
    directions.includes("better") && directions.includes("worse")
      ? "mixed"
      : (directions[0] ?? "equal on available measurements");
  return (
    <div className="sof-supplier-comparison-table">
      <h4>Managed outcomes: {outcome} on selected observed metrics</h4>
      <p>
        This direction summary describes these IDs only, not a policy effect.
        Served means may use different tickets; baseline n = {b.value.servedN},
        managed n = {s.value.servedN}. Unavailable samples are not treated as
        zero.
      </p>
      <table>
        <caption>Selected actual run outcomes; no inferred savings</caption>
        <thead>
          <tr>
            <th scope="col">Measurement</th>
            <th scope="col">Oldest-first</th>
            <th scope="col">Managed</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label}>
              <th scope="row">{row.label}</th>
              <td>
                {row.ticketTime
                  ? format(
                      row.before === null ? null : row.before / 1000,
                      " ticket-seconds"
                    )
                  : row.time
                    ? seconds(row.before)
                    : format(row.before)}
              </td>
              <td>
                {row.ticketTime
                  ? format(
                      row.after === null ? null : row.after / 1000,
                      " ticket-seconds"
                    )
                  : row.time
                    ? seconds(row.after)
                    : format(row.after)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Local preview sibling. No released store, sounds, generic config injection, persistence or exports. */
export default function SliceOfFlowSupplierRound({
  speed,
  onClose,
}: SliceOfFlowSupplierRoundProps) {
  const headingId = useId();
  const [nextSpeed, setNextSpeed] = useState(speed);
  const [session, setSession] = useState<IndependentSession | null>(null);
  const current = useRef<IndependentSession | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const firstTicket = useRef<HTMLButtonElement>(null);
  const helpButton = useRef<HTMLButtonElement>(null);
  const exitButton = useRef<HTMLButtonElement>(null);
  const restoreTicketFocus = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [scoreVisible, setScoreVisible] = useState(true);
  const [message, setMessage] = useState(
    "Start the oldest-first baseline when ready. Nothing runs before Start."
  );
  const [baselineId, setBaselineId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [viewedRunId, setViewedRunId] = useState("");
  const cancelSchedule = useCallback(() => {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);
  const wall = useCallback(
    () =>
      integerWallUs(
        performance.now(),
        current.current?.driver.lastWallUs ?? null
      ),
    []
  );
  const commit = useCallback(
    (next: IndependentSession) => {
      if (next === current.current) return;
      cancelSchedule();
      current.current = next;
      setSession(next);
    },
    [cancelSchedule]
  );
  const dispatch = useCallback(
    (command: EngineCommand, sampledWall?: number) => {
      const state = current.current;
      if (!state || state.status !== "active") return null;
      const result = commandIndependentSession(
        state,
        sessionToken(state),
        sampledWall ?? wall(),
        command
      );
      commit(result.state);
      if (!result.accepted)
        setMessage(feedback(result.issues[0]?.code ?? "INVALID_COMMAND"));
      return result;
    },
    [commit, wall]
  );
  const active = session?.status === "active";
  const engine = session?.engine;
  const retained = session?.archive.runs ?? [];
  useLayoutEffect(() => {
    const element = root.current;
    const watch = element?.querySelector<HTMLElement>(".sof-supplier-watch");
    if (!element || !watch) return;
    const measure = () =>
      element.style.setProperty(
        "--supplier-watch-clearance",
        `${Math.ceil(watch.getBoundingClientRect().height) + 24}px`
      );
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(watch);
    return () => observer.disconnect();
  }, [active]);
  const hasBaseline = retained.some(
    run => run.config.policy.variantId === "naive"
  );
  const pilot = makeSupplierConfig({
    variant: "naive",
    initialSpeed: nextSpeed,
    guidedStart: true,
  });
  const start = (variant: SupplierVariant) => {
    if (
      current.current?.status === "active" ||
      (variant === "managed" &&
        !current.current?.archive.runs.some(
          run => run.config.policy.variantId === "naive"
        ))
    )
      return;
    // Randomness allocates opaque identity only; never demand, delays, or gameplay.
    const input = {
      sessionCode: `supplier-${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
      speed: nextSpeed,
      variant,
    };
    const sampledWall = wall();
    const result = current.current
      ? replaySupplierSession(current.current, input, sampledWall)
      : startSupplierSession(input, sampledWall);
    if (!result.ok) {
      setMessage(feedback(result.issues[0]?.code ?? "INVALID_START"));
      return;
    }
    commit(result.value);
    setSelected(null);
    setScoreVisible(true);
    setViewedRunId("");
    setMessage(
      `${POLICY_NAMES[variant]} started. Read the instructions, then try the first order.`
    );
    if (document.hidden) dispatch(visibilityCommand(true), sampledWall);
  };
  useEffect(() => {
    const state = current.current;
    if (!state || state.status !== "active" || state.engine.pausedBy.length)
      return;
    const token = sessionToken(state);
    timer.current = setTimeout(() => {
      timer.current = null;
      const latest = current.current;
      if (!latest) return;
      const result = sampleIndependentSession(latest, token, wall());
      if (result.accepted) commit(result.state);
      else if (result.issues[0]?.code !== "STALE_SESSION")
        setMessage(feedback(result.issues[0]?.code ?? "INVALID_SAMPLE"));
    }, 100);
    return cancelSchedule;
  }, [
    session?.runId,
    session?.revision,
    session?.status,
    commit,
    cancelSchedule,
    wall,
  ]);
  useEffect(() => {
    if (session?.status !== "active") return;
    const visibility = () => {
      if (document.hidden) cancelSchedule();
      dispatch(visibilityCommand(document.hidden));
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, [session?.runId, session?.status, dispatch, cancelSchedule]);
  useEffect(() => {
    if (session?.status !== "active") return;
    const pageExit = () => {
      cancelSchedule();
      const state = current.current;
      if (state?.status === "active")
        commit(
          abandonIndependentSession(state, sessionToken(state), "unmount").state
        );
    };
    window.addEventListener("pagehide", pageExit);
    return () => window.removeEventListener("pagehide", pageExit);
  }, [session?.runId, session?.status, commit, cancelSchedule]);
  useEffect(
    () => () => {
      cancelSchedule();
      const state = current.current;
      if (state?.status === "active")
        current.current = abandonIndependentSession(
          state,
          sessionToken(state),
          "unmount"
        ).state;
    },
    [cancelSchedule]
  );
  useEffect(() => {
    if (session?.status === "final" || session?.status === "abandoned")
      heading.current?.focus({ preventScroll: true });
  }, [session?.status]);
  useLayoutEffect(() => {
    if (!restoreTicketFocus.current) return;
    restoreTicketFocus.current = false;
    const ticket = Array.from(
      root.current?.querySelectorAll<HTMLButtonElement>(
        "[data-supplier-ticket]"
      ) ?? []
    ).find(element => element.dataset.supplierTicket === selected);
    (ticket ?? helpButton.current)?.focus({ preventScroll: true });
  }, [session?.revision, selected]);
  const paused = !!engine?.pausedBy.length;
  const instruction = active && !!engine?.pausedBy.includes("instruction");
  const help = active && !!engine?.pausedBy.includes("help");
  const exit = active && !!engine?.pausedBy.includes("exit-confirmation");
  const guided = active && engine?.guide === "pending" && !instruction;
  const variant =
    engine?.config.policy.variantId === "managed" ? "managed" : "naive";
  const orders = engine?.config.manifest.orders ?? [];
  const external = orders
    .filter(
      order =>
        engine?.tickets.find(ticket => ticket.orderKey === order.orderKey)
          ?.status === "external"
    )
    .sort(byArrival);
  const next = external[0];
  const admission =
    engine && next
      ? applyAction(engine, { kind: "admit", orderKey: next.orderKey })
      : null;
  const selectedTicket = engine?.tickets.find(
    ticket => ticket.orderKey === selected && ticket.status === "active"
  );
  const destination = selectedTicket?.station
    ? [...STATIONS, "served" as const][
        STATIONS.indexOf(selectedTicket.station) + 1
      ]
    : null;
  const plannedMove: EngineCommand | null =
    selectedTicket && destination
      ? { kind: "move", orderKey: selectedTicket.orderKey, to: destination }
      : null;
  const moveDecision =
    engine && plannedMove ? applyAction(engine, plannedMove) : null;
  const laneCounts = STATIONS.map(
    station =>
      engine?.tickets.filter(
        ticket => ticket.status === "active" && ticket.station === station
      ).length ?? 0
  );
  const laneHeight = Math.max(1, ...laneCounts) + 2;
  const moveSelected = () => {
    if (!plannedMove) return;
    const sampledWall = wall();
    const result = dispatch(plannedMove, sampledWall);
    if (!result?.accepted) return;
    restoreTicketFocus.current = true;
    if (destination === "served") setSelected(null);
    setMessage(
      destination === "served"
        ? "Delivered. Pull or select another ticket."
        : `Moved to ${STATION_NAMES[destination as Station]}.`
    );
    if (result.state.engine.guide === "moved") {
      dispatch(
        { kind: "set-pause", reason: "guide", active: false },
        sampledWall
      );
      setMessage(
        "First move complete. The active kitchen clock is now running."
      );
    }
  };
  const admit = () => {
    if (!next) return;
    const result = dispatch({ kind: "admit", orderKey: next.orderKey });
    if (result?.accepted)
      setMessage(`Order ${next.ordinal} pulled into Orders.`);
  };
  const closeOwner = (reason: "instruction" | "help" | "exit-confirmation") =>
    dispatch({ kind: "set-pause", reason, active: false });
  const close = () => {
    if (active) dispatch(exitConfirmationCommand(true));
    else onClose?.();
  };
  const confirmExit = () => {
    const state = current.current;
    if (!state) return;
    const result = abandonIndependentSession(
      state,
      sessionToken(state),
      "confirmed-exit"
    );
    if (result.accepted) {
      commit(result.state);
      setMessage(
        "Run abandoned. No completed snapshot was created for this attempt."
      );
      onClose?.();
    }
  };
  const pair: PairSpec | null =
    baselineId && subjectId
      ? {
          pairId: "supplier-selected-pair",
          baselineRunId: baselineId,
          subjectRunId: subjectId,
          requestedBasis: "matched",
          change: {
            dimensionId: SUPPLIER_VERSIONS.policy,
            version: SUPPLIER_VERSIONS.policyVersion,
            beforeVariantId: "naive",
            afterVariantId: "managed",
          },
        }
      : null;
  const assessment =
    session && pair ? assessComparison(session.archive, pair) : null;
  const baselineSnapshot = retained.find(run => run.runId === baselineId);
  const subjectSnapshot = retained.find(run => run.runId === subjectId);
  const viewedSnapshot =
    retained.find(run => run.runId === viewedRunId) ?? session?.snapshot;
  const horizonMs =
    active && engine
      ? engine.config.manifest.horizonMs
      : pilot.ok
        ? pilot.value.manifest.horizonMs
        : SUPPLIER_PILOT_TIMING.horizonMs;
  const displaySpeed = active && engine ? engine.speed : nextSpeed;
  const supplierPhase =
    !engine || engine.nowMs < SUPPLIER_PILOT_TIMING.startMs
      ? "scheduled"
      : engine.nowMs < SUPPLIER_PILOT_TIMING.endMs
        ? "shortage"
        : "delivery";
  return (
    <section
      ref={root}
      className="sof-independent-lab sof-independent-preview sof-supplier-round"
      aria-labelledby={headingId}
      data-testid="supplier-round"
      data-preview-only="true"
    >
      <header className="sof-lab-heading">
        <p className="sof-lab-eyebrow">Optional draft pilot · Normal only</p>
        <h2 id={headingId} ref={heading} tabIndex={-1}>
          Round 4 supplier-only pilot — partial
        </h2>
        <aside
          className="sof-supplier-intro"
          aria-label="Supplier pilot introduction"
        >
          <p>
            A missing ingredient can stall an unstarted pizza. Run the
            oldest-first baseline, then optionally try managed sequencing. Watch
            which tickets wait, what still flows, and what remains unfinished.
            Nothing runs before Start.
          </p>
        </aside>
        <details className="sof-supplier-disclosure">
          <summary>Operational disclosure and pilot limits</summary>
          <p>
            No rework, swarm, or outage is implemented. Original Round 1/2 and
            released VIP/Lab rules are unchanged; no Round 2 matched claim is
            made.
          </p>
          <p>
            Fixed 12-ticket fixture, all available at 0 simulated seconds.
            Normal only · active horizon {horizonMs / 1000} simulated seconds.
            WIP: Orders 4 · Prep 2 · Oven 3 · Pizza Box 2; two Prep workers and
            three oven slots.
          </p>
          <p>
            Veggie Supreme shortage: {SUPPLIER_PILOT_TIMING.startMs / 1000}–
            {SUPPLIER_PILOT_TIMING.endMs / 1000} simulated seconds (
            {(SUPPLIER_PILOT_TIMING.endMs - SUPPLIER_PILOT_TIMING.startMs) /
              1000}
            s provisional). Only tickets not yet started in Prep are affected.
            Already-Prep work is unaffected; delivery never auto-moves a ticket.
          </p>
          <p>{POLICY_COPY}</p>
          <p>
            Both policies show identical supplier timing, blockers, ages, and
            capacity. Ideal uninterrupted wall time at {displaySpeed}×:{" "}
            {format(horizonMs / 1000 / displaySpeed, " seconds")}. Pauses add
            time; this is not a guaranteed workshop duration or outcome.
          </p>
        </details>
        <p>
          Local memory only. No personalized input, persistence, uploads,
          shares, or exports. Closing or reloading loses these results.
        </p>
        <SliceOfFlowAuthorCredit />
      </header>
      {!active && (
        <section
          aria-label="Supplier pilot setup"
          className="sof-supplier-setup"
        >
          <h3>
            {session ? "Choose your next attempt" : "Start with oldest-first"}
          </h3>
          <p>{POLICY_COPY}</p>
          <div className="sof-lab-actions">
            <label>
              Next run speed{" "}
              <select
                aria-label="Next run speed"
                value={nextSpeed}
                onChange={event =>
                  setNextSpeed(Number(event.target.value) as Speed)
                }
              >
                <option value={1}>1×</option>
                <option value={2}>2×</option>
                <option value={3}>3×</option>
              </select>
            </label>
            <span>Normal only · {horizonMs / 1000} simulated seconds</span>
          </div>
          <p>
            Settings apply to the next run only. Different speeds can prevent a
            matched comparison.
          </p>
          <div className="sof-lab-actions">
            <button
              type="button"
              disabled={!pilot.ok}
              onClick={() => start("naive")}
            >
              Start oldest-first baseline
            </button>
            <button
              type="button"
              disabled={!hasBaseline || !pilot.ok}
              onClick={() => start("managed")}
            >
              Start managed sequencing
            </button>
            {!hasBaseline && (
              <span>
                Record a baseline first. Manual End run records a result, but is
                not matched.
              </span>
            )}
            {onClose && (
              <button type="button" onClick={close}>
                Close supplier pilot
              </button>
            )}
          </div>
        </section>
      )}
      {active && engine && (
        <>
          <h3>{POLICY_NAMES[variant]} kitchen</h3>
          <p>
            Active run ID: <code>{session.runId}</code>
          </p>
          <nav
            className="sof-lab-actions"
            aria-label="Supplier kitchen controls"
          >
            <button
              type="button"
              onClick={() =>
                dispatch(
                  facilitatorCommand(!engine.pausedBy.includes("facilitator"))
                )
              }
            >
              {engine.pausedBy.includes("facilitator")
                ? "Resume kitchen"
                : "Pause kitchen"}
            </button>
            <button
              type="button"
              ref={helpButton}
              onClick={() =>
                dispatch({ kind: "set-pause", reason: "help", active: true })
              }
            >
              Help
            </button>
            <button
              type="button"
              onClick={() => setScoreVisible(value => !value)}
            >
              {scoreVisible ? "Hide live scores" : "Show live scores"}
            </button>
            <button
              type="button"
              disabled={paused}
              onClick={() => dispatch({ kind: "end", reason: "manual-stop" })}
            >
              End run
            </button>
            <button type="button" ref={exitButton} onClick={close}>
              Leave kitchen
            </button>
          </nav>
          <p className="sof-lab-pause">
            {paused
              ? `Kitchen paused — ${engine.pausedBy.map(reason => PAUSE_NAMES[reason]).join(", ")}.`
              : "Kitchen running."}{" "}
            Resume kitchen removes only the facilitator pause. Run speed:{" "}
            {engine.speed}×; settings are next run only.
          </p>
          <div
            className="sof-supplier-watch"
            data-testid="supplier-watch"
            data-supplier-phase={supplierPhase}
            aria-label="Supplier watch"
          >
            <strong
              role="status"
              aria-live="polite"
              aria-atomic="true"
              data-testid="supplier-live-status"
            >
              Supplier watch ·{" "}
              {supplierPhase === "scheduled"
                ? "Scheduled shortage"
                : supplierPhase === "shortage"
                  ? "Shortage active"
                  : "Delivery received"}
            </strong>
            <span>
              {supplierPhase === "scheduled"
                ? `Veggie Supreme: shortage at ${SUPPLIER_PILOT_TIMING.startMs / 1000}s; delivery at ${SUPPLIER_PILOT_TIMING.endMs / 1000}s.`
                : supplierPhase === "shortage"
                  ? `Veggie Supreme waiting; delivery at ${SUPPLIER_PILOT_TIMING.endMs / 1000}s.`
                  : "Veggie Supreme supply restored. Move permitted tickets manually."}
            </span>
            <span>
              Unstarted only; already-Prep work unaffected. No automatic moves.
            </span>
            <span data-testid="supplier-timer">
              Kitchen time remaining:{" "}
              {Math.max(0, Math.ceil((horizonMs - engine.nowMs) / 1000))}{" "}
              simulated seconds{paused && " · Paused"}
            </span>
          </div>
          <div className="sof-lab-operational" aria-label="Kitchen operations">
            <span>
              External tickets: {external.length} · separate from active WIP
            </span>
            {scoreVisible ? (
              <div
                className="sof-lab-live-score"
                data-testid="supplier-live-scores"
              >
                <span>
                  Served:{" "}
                  {
                    engine.tickets.filter(ticket => ticket.status === "served")
                      .length
                  }
                </span>
                <span>
                  Burnt:{" "}
                  {
                    engine.tickets.filter(ticket => ticket.status === "burnt")
                      .length
                  }
                </span>
                <span>
                  Angry: {engine.tickets.filter(ticket => ticket.angry).length}
                </span>
              </div>
            ) : (
              <span>Live scores hidden</span>
            )}
          </div>
          <p className="sof-lab-helper">
            {guided
              ? "First move: select Order 1 with Enter, Space, or its button; move to Prep. The clock waits for this valid move."
              : "Select a ticket with Enter, Space, or its button. Use ArrowRight on the selected ticket or the highlighted destination button to move. Wait for Ready in Prep and Oven; watch the burn timer."}
          </p>
          <section
            className="sof-supplier-external"
            aria-label="External tickets, not active WIP"
          >
            <h3>External tickets — not active WIP</h3>
            <div className="sof-lab-actions">
              <button
                type="button"
                disabled={!admission?.accepted}
                onClick={admit}
              >
                Pull next order into Orders
              </button>
              <span>
                {next
                  ? `Next: Order ${next.ordinal} · ${TYPE_NAMES[next.orderTypeId] ?? next.orderTypeId}. ${admission?.accepted ? "Available to pull (FIFO)." : feedback(admission?.issues[0]?.code ?? "NOT_AVAILABLE")}`
                  : "All tickets have been admitted."}
              </span>
            </div>
            <details>
              <summary>External backlog ({external.length})</summary>
              <ol>
                {external.map(order => (
                  <li key={order.orderKey}>
                    Order {order.ordinal} ·{" "}
                    {TYPE_NAMES[order.orderTypeId] ?? order.orderTypeId} ·
                    outside active WIP
                  </li>
                ))}
              </ol>
            </details>
          </section>
          <div
            className="sof-supplier-board"
            aria-label="Active kitchen stations and tickets"
            data-testid="supplier-board"
          >
            {STATIONS.map((station, index) => (
              <section
                key={station}
                role="region"
                aria-label={STATION_NAMES[station]}
                style={gridPosition(index, 0, laneHeight)}
                className={`sof-supplier-lane-head sof-lab-${station} ${moveDecision?.accepted && destination === station ? "sof-supplier-destination-ready" : ""}`}
              >
                <h3>{STATION_NAMES[station]}</h3>
                <p>
                  Occupancy: {laneCounts[index]} /{" "}
                  {engine.config.policy.wip[station]} WIP slots
                </p>
                {(station === "prep" || station === "oven") && (
                  <p>
                    {engine.config.resources.occupancy[station]} physical{" "}
                    {station === "prep" ? "Prep workers" : "oven slots"}
                  </p>
                )}
                {moveDecision?.accepted && destination === station && (
                  <p>Ready destination for selected ticket</p>
                )}
                {laneCounts[index] === 0 && <p>No active tickets</p>}
              </section>
            ))}
            {engine.tickets
              .filter(ticket => ticket.status === "active" && ticket.station)
              .map(ticket => {
                const station = ticket.station!;
                const order = orders.find(
                  item => item.orderKey === ticket.orderKey
                )!;
                const row =
                  engine.tickets
                    .filter(
                      item =>
                        item.status === "active" && item.station === station
                    )
                    .findIndex(item => item.orderKey === ticket.orderKey) + 1;
                const readyAt =
                  station === "prep"
                    ? ticket.prepReadyAtMs
                    : ticket.ovenReadyAtMs;
                const block = readSupplierBlock(engine, ticket.orderKey);
                return (
                  <button
                    type="button"
                    key={ticket.orderId}
                    style={gridPosition(
                      STATIONS.indexOf(station),
                      row,
                      laneHeight
                    )}
                    className={`sof-lab-ticket sof-supplier-ticket ${block?.blocked ? "sof-supplier-blocked" : ""}`}
                    data-supplier-ticket={ticket.orderKey}
                    data-supplier-station={station}
                    ref={
                      ticket.orderKey === "order-1" ? firstTicket : undefined
                    }
                    aria-pressed={selected === ticket.orderKey}
                    onClick={() => {
                      setSelected(ticket.orderKey);
                      setMessage(
                        `Order ${order.ordinal} selected. Next destination is one station forward.`
                      );
                    }}
                    onKeyDown={event => {
                      if (
                        event.key === "ArrowRight" &&
                        selected === ticket.orderKey
                      ) {
                        event.preventDefault();
                        moveSelected();
                      }
                    }}
                  >
                    <strong>
                      Order {order.ordinal} ·{" "}
                      {TYPE_NAMES[order.orderTypeId] ?? order.orderTypeId}
                    </strong>
                    <span>
                      At {STATION_NAMES[station]} · {order.complexity} · Prep{" "}
                      {order.prepMs / 1000}s · Oven {order.bakeMs / 1000}s
                    </span>
                    {block?.blocked ? (
                      <span className="sof-supplier-block-label">
                        {block.reason} · Owner: {block.owner} · active simulated
                        age {format(block.ageMs / 1000, "s")} · retains Orders
                        WIP
                      </span>
                    ) : station === "prep" || station === "oven" ? (
                      <span>
                        {ticket.ready
                          ? "Ready"
                          : `Working: ${Math.max(0, Math.ceil(((readyAt ?? engine.nowMs) - engine.nowMs) / 1000))}s remaining`}
                      </span>
                    ) : (
                      <span>
                        Ready to{" "}
                        {station === "boxDeliver" ? "deliver" : "request Prep"}
                      </span>
                    )}
                    {station === "oven" && (
                      <span>
                        Burn hazard:{" "}
                        {Math.max(
                          0,
                          Math.ceil(
                            ((ticket.burnAtMs ?? engine.nowMs) - engine.nowMs) /
                              1000
                          )
                        )}
                        s until burn
                      </span>
                    )}
                    <span>
                      Orders age:{" "}
                      {Math.floor(
                        (engine.nowMs - (ticket.admittedAtMs ?? engine.nowMs)) /
                          1000
                      )}
                      s{ticket.angry ? " · Customer angry" : ""}
                    </span>
                  </button>
                );
              })}
          </div>
          <div className="sof-lab-actions sof-supplier-move">
            <button
              type="button"
              data-supplier-destination={destination ?? ""}
              className={
                moveDecision?.accepted ? "sof-supplier-destination-ready" : ""
              }
              disabled={!moveDecision?.accepted}
              onClick={moveSelected}
            >
              {destination
                ? destination === "served"
                  ? "Deliver selected ticket"
                  : `Move selected ticket to ${STATION_NAMES[destination]}`
                : "Select a ticket to move"}
            </button>
            <span>
              {selectedTicket
                ? moveDecision?.accepted
                  ? `Ready destination: ${destination === "served" ? "delivery" : STATION_NAMES[destination!]}.`
                  : feedback(moveDecision?.issues[0]?.code ?? "INVALID_MOVE")
                : "Select an active ticket to see its destination."}
            </span>
          </div>
        </>
      )}
      <p
        className="sof-lab-feedback"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {message}
      </p>
      {!active && viewedSnapshot && (
        <SupplierResult snapshot={viewedSnapshot} />
      )}
      {session?.status === "abandoned" && (
        <p>
          Attempt {session.attempt} abandoned. No completed snapshot exists for
          this attempt. Earlier completed results remain retained locally.
        </p>
      )}
      {!active && retained.length > 0 && (
        <>
          <section aria-label="Retained immutable results">
            <h3>Retained results</h3>
            <p>
              Every completed attempt has a distinct immutable ID. Replays never
              replace results.
            </p>
            <ul>
              {retained.map(run => (
                <li key={run.runId}>
                  <code>{run.runId}</code> ·{" "}
                  {run.config.policy.variantId === "naive"
                    ? POLICY_NAMES.naive
                    : POLICY_NAMES.managed}{" "}
                  · Normal · {run.config.initialSpeed}× · {run.endReason}{" "}
                  <button
                    type="button"
                    onClick={() => setViewedRunId(run.runId)}
                  >
                    View result {run.runId}
                  </button>
                </li>
              ))}
            </ul>
            {viewedRunId && (
              <button type="button" onClick={() => setViewedRunId("")}>
                Return to current result
              </button>
            )}
          </section>
          <section
            className="sof-lab-final"
            aria-label="Explicit supplier run comparison"
          >
            <h3>Choose comparison IDs</h3>
            <p>
              No latest or best pair is selected automatically. Choose a
              retained oldest-first ID and a distinct managed ID.
            </p>
            <div className="sof-lab-actions">
              <label>
                Baseline attempt{" "}
                <select
                  aria-label="Baseline attempt"
                  value={baselineId}
                  onChange={event => setBaselineId(event.target.value)}
                >
                  <option value="">Choose a baseline ID</option>
                  {retained
                    .filter(run => run.config.policy.variantId === "naive")
                    .map(run => (
                      <option key={run.runId} value={run.runId}>
                        {run.runId}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Comparison attempt (managed){" "}
                <select
                  aria-label="Comparison attempt (managed)"
                  value={subjectId}
                  onChange={event => setSubjectId(event.target.value)}
                >
                  <option value="">Choose a managed ID</option>
                  {retained
                    .filter(
                      run =>
                        run.config.policy.variantId === "managed" &&
                        run.runId !== baselineId
                    )
                    .map(run => (
                      <option key={run.runId} value={run.runId}>
                        {run.runId}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div data-testid="supplier-comparison-basis">
              {assessment ? (
                <>
                  <h3>
                    {assessment.kind === "matched"
                      ? "Matched conditions"
                      : "Not matched"}
                  </h3>
                  <p>
                    Basis: {assessment.kind}. Requested dimension:{" "}
                    {SUPPLIER_VERSIONS.policy}/{SUPPLIER_VERSIONS.policyVersion}{" "}
                    · naive → managed.
                  </p>
                  <p>
                    Explicit baseline: <code>{assessment.baselineRunId}</code> ·
                    managed: <code>{assessment.subjectRunId}</code>.
                  </p>
                  {assessment.issues.length > 0 && (
                    <ul>
                      {assessment.issues.map(reason => (
                        <li key={reason}>
                          {reason.replaceAll("_", " ").toLowerCase()}
                        </li>
                      ))}
                    </ul>
                  )}
                  {assessment.details.length > 0 && (
                    <p>
                      {assessment.details
                        .map(
                          detail =>
                            `${detail.side}: ${detail.code} (${detail.path})`
                        )
                        .join("; ")}
                    </p>
                  )}
                </>
              ) : (
                <p>Comparison not selected. Both ID choices start empty.</p>
              )}
            </div>
            <p>
              Only canonical assessComparison grants a matched basis after
              checking the official fixture, physical resources, timing,
              settings, full identical observation horizons, accepted control
              traces, and approved naive↔managed dimension. Manual ends are not
              matched, even at equal durations.
            </p>
            {baselineSnapshot && subjectSnapshot && (
              <SupplierComparison
                baseline={baselineSnapshot}
                subject={subjectSnapshot}
              />
            )}
            <p>{DISCLAIMER}</p>
          </section>
          <section aria-label="Team debrief">
            <h3>Bring the dependency back to work</h3>
            <ol>
              <li>
                How did you track the dependency, its Supplier owner, and the
                age of blocked work? What evidence did the tickets provide?
              </li>
              <li>
                Did choosing unblocked work help, hurt, or mix outcomes? What
                remained in WIP, and what was never admitted?
              </li>
              <li>
                What is the real ingredient equivalent in your team: a decision,
                environment, approval, or external delivery?
              </li>
              <li>
                What one dependency-tracking and sequencing rule would you try
                at work without adding capacity?
              </li>
            </ol>
            <p>
              Discuss observed evidence, not an assumed lesson. No rework,
              swarm, or outage was tested.
            </p>
          </section>
        </>
      )}
      <SliceOfFlowDialog
        open={!!instruction}
        title="Supplier pilot instructions"
        description="Read the policy and try the first order. The clock is paused."
        onDismiss={() => closeOwner("instruction")}
        onReturnFocus={() =>
          firstTicket.current?.focus({ preventScroll: true })
        }
      >
        <div className="sof-lab-dialog sof-supplier-dialog">
          <h2>{POLICY_NAMES[variant]} instructions</h2>
          <p>{POLICY_COPY}</p>
          <p>
            Select tickets with Enter, Space, or their button. Move with
            ArrowRight or the destination button. Wait for Ready in Prep and
            Oven; avoid burns. Instructions and the first Orders-to-Prep move
            pause the clock.
          </p>
          <p>
            The same supplier watch is visible in both policies. Only unstarted
            Veggie Supreme tickets can wait; delivery does not move them.
          </p>
          <button
            type="button"
            data-dialog-initial
            onClick={() => closeOwner("instruction")}
          >
            Try the first order
          </button>
        </div>
      </SliceOfFlowDialog>
      <SliceOfFlowDialog
        open={!!help}
        title="Supplier kitchen help"
        description="Keyboard controls, dependency limits, hazards and pause ownership."
        onDismiss={() => closeOwner("help")}
        onReturnFocus={() => helpButton.current?.focus({ preventScroll: true })}
      >
        <div className="sof-lab-dialog sof-supplier-dialog">
          <h2>How to play</h2>
          <p>
            Select with Enter, Space, or a ticket button. Use ArrowRight on the
            selected ticket or the highlighted destination button. Prep and Oven
            require Ready; move baked tickets before the burn timer expires.
          </p>
          <p>{POLICY_COPY}</p>
          <p>
            Waiting on supplier means unstarted Veggie Supreme work.
            Already-Prep work is unaffected. The Supplier owner and active
            simulated age show on blocked cards. Delivery only removes the
            blocker; you still move tickets yourself.
          </p>
          <p>
            Resume kitchen removes only facilitator ownership. Instructions,
            guide, help, hidden tab, transition, and exit confirmation keep
            their own pauses. This silent pilot never controls the original
            kitchen.
          </p>
          <SliceOfFlowOrderGuide compact headingLevel={3} />
          <button
            type="button"
            data-dialog-initial
            onClick={() => closeOwner("help")}
          >
            Close help
          </button>
        </div>
      </SliceOfFlowDialog>
      <SliceOfFlowDialog
        open={!!exit}
        title="Abandon this supplier run?"
        description="Exit confirmation pauses the kitchen. Confirming abandons without a completed snapshot."
        onDismiss={() => closeOwner("exit-confirmation")}
        onReturnFocus={() => exitButton.current?.focus({ preventScroll: true })}
      >
        <div className="sof-lab-dialog sof-supplier-dialog">
          <h2>Abandon this run?</h2>
          <p>
            Confirming discards this active attempt without recording a
            completed result. Cancel removes only exit-confirmation ownership.
            Earlier completed results remain local until this pilot closes.
          </p>
          <button
            type="button"
            data-dialog-initial
            onClick={() => closeOwner("exit-confirmation")}
          >
            Cancel exit
          </button>
          <button type="button" onClick={confirmExit}>
            Abandon run and exit
          </button>
        </div>
      </SliceOfFlowDialog>
    </section>
  );
}
