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
import SliceOfFlowVipComparisonTable from "./SliceOfFlowVipComparisonTable";
import {
  abandonIndependentSession,
  commandIndependentSession,
  exitConfirmationCommand,
  facilitatorCommand,
  integerWallUs,
  replayVipSession,
  sampleIndependentSession,
  sessionToken,
  startVipSession,
  visibilityCommand,
  type IndependentSession,
} from "@/lib/sof/independentSession";
import { readVipActivity } from "@/lib/sof/vip";
import { readCurrentNormalVipWait } from "@/lib/sof/vipWaiting";
import { applyAction } from "@/lib/sofEngine/engine";
import { assessComparison, type PairSpec } from "@/lib/sofEngine/matchedRuns";
import {
  makeVipConfig,
  measureVipResults,
  type VipVariant,
} from "@/lib/sofEngine/vip";
import {
  STATIONS,
  type DemandOrder,
  type Difficulty,
  type EngineCommand,
  type FinalRunSnapshot,
  type Speed,
  type Station,
} from "@/lib/sofEngine/types";
import "@/lib/sliceOfFlowIndependentLab.css";
import "@/lib/sliceOfFlowVip.css";

export interface SliceOfFlowVipRoundProps {
  difficulty: Difficulty;
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
const PAUSE_NAMES = {
  instruction: "instructions",
  guide: "first-order guide",
  help: "help",
  facilitator: "facilitator",
  transition: "transition",
  "exit-confirmation": "exit confirmation",
  hidden: "hidden tab",
};
const POLICY_NAMES = { fifo: "FIFO baseline", expedite: "VIP expedite" };
const DISCLAIMER =
  "Matched conditions are not a causal claim: human choices can differ. Outcomes may be mixed, equal, adverse, or unavailable. This pilot does not establish human play or production-policy approval.";
const format = (value: number | null, unit = "") =>
  value === null
    ? "N/A (no observed samples)"
    : `${value.toFixed(2).replace(/\.00$/, "")}${unit}`;
const seconds = (ms: number | null) =>
  format(ms === null ? null : ms / 1000, " simulated seconds");
/** Normal orders intentionally omit metadata; only the canonical serviceClass field identifies VIPs. */
const isVip = (order: DemandOrder) => order.serviceClass === "vip";
const byArrival = (a: DemandOrder, b: DemandOrder) =>
  a.availableAtMs - b.availableAtMs ||
  a.ordinal - b.ordinal ||
  a.orderKey.localeCompare(b.orderKey);
function feedback(code: string): string {
  const messages: Record<string, string> = {
    PAUSED:
      "Kitchen paused. Close the owning dialog or use Resume kitchen for the facilitator pause.",
    CAPACITY:
      "Destination is full. Move a ready ticket out, then try again. VIPs never gain a Prep worker or oven slot.",
    NOT_READY: "Wait for Ready before moving this ticket.",
    FIFO: "FIFO requires the oldest available ticket, including VIPs. In expedite, pull the earliest available ticket of the requested class.",
    NOT_AVAILABLE: "This order is not available to pull.",
    NOT_ACTIVE: "Select an active ticket.",
    INVALID_MOVE: "Move only to the next station.",
    STALE_SESSION: "The run changed. Try again.",
    ENDED:
      "The active clock reached the observation horizon. The actual final result is recorded.",
    VIP_TOKEN:
      "One VIP is already active. Finish that VIP before pulling another.",
    VIP_ACTIVE:
      "One VIP is already active. Finish that VIP before pulling another.",
    VIP_FIFO: "Pull the earliest available VIP first.",
  };
  return messages[code] ?? `Action not accepted (${code}). No move was made.`;
}
function deadlineText(order: DemandOrder, nowMs: number): string {
  if (!isVip(order) || order.deadlineAtMs === undefined) return "";
  const remaining = order.deadlineAtMs - nowMs;
  return remaining < 0
    ? `Overdue by ${Math.ceil(-remaining / 1000)}s`
    : remaining === 0
      ? "Due now"
      : `Due in ${Math.ceil(remaining / 1000)}s`;
}
/** Stable direct children retain the moving ticket's DOM node across station changes. */
function gridPosition(
  stationIndex: number,
  ticketRow: number,
  laneHeight: number
): CSSProperties {
  return {
    "--vip-col-wide": stationIndex + 1,
    "--vip-row-wide": ticketRow + 1,
    "--vip-col-medium": (stationIndex % 2) + 1,
    "--vip-row-medium":
      Math.floor(stationIndex / 2) * laneHeight + ticketRow + 1,
    "--vip-row-small": stationIndex * laneHeight + ticketRow + 1,
  } as CSSProperties;
}
function VipResult({ snapshot }: { snapshot: FinalRunSnapshot }) {
  const checked = measureVipResults(snapshot);
  if (!checked.ok)
    return (
      <section className="sof-lab-final" data-testid="vip-results">
        <h3>Result unavailable</h3>
        <p>
          Canonical validation did not accept this result:{" "}
          {checked.issues.map(i => i.code).join(", ")}.
        </p>
      </section>
    );
  const summary = checked.value;
  const durationMs = snapshot.observation.durationMs;
  const deliveryRate =
    durationMs > 0 ? (snapshot.metrics.served * 60000) / durationMs : null;
  const policy =
    snapshot.config.policy.variantId === "fifo"
      ? "FIFO baseline"
      : "VIP expedite";
  return (
    <section
      className="sof-lab-final sof-vip-result"
      data-testid="vip-results"
      data-run-id={snapshot.runId}
      data-variant={snapshot.config.policy.variantId}
      aria-label="Actual VIP pilot run measurements"
    >
      <h3>{policy} result</h3>
      <p>
        Retained run ID: <code>{snapshot.runId}</code>
      </p>
      <p>
        Actual observation: {seconds(durationMs)} ·{" "}
        {snapshot.endReason === "manual-stop"
          ? "Manual end — not matched"
          : snapshot.endReason}{" "}
        · complete engine-boundary ledger.
      </p>
      <dl>
        <div>
          <dt>Final canonical VIP score</dt>
          <dd>
            {summary.score} points · {summary.deadlinePenaltyCount} deadline
            penalties
          </dd>
        </div>
        <div>
          <dt>VIP outcomes (all three orders)</dt>
          <dd>
            On time: {summary.vipOnTime} · Late: {summary.vipLate} · Pending:{" "}
            {summary.vipPending} · Not yet arrived: {summary.vipNotYetArrived} ·
            Burnt: {summary.vipBurnt}
          </dd>
        </div>
        <div>
          <dt>Total served / burnt / angry</dt>
          <dd>
            {snapshot.metrics.served} / {snapshot.metrics.burnt} /{" "}
            {snapshot.metrics.angry}
          </dd>
        </div>
        <div>
          <dt>Actual delivery rate (served only)</dt>
          <dd>
            {deliveryRate === null
              ? "N/A (zero observation duration)"
              : format(deliveryRate, " tickets per simulated minute")}
          </dd>
        </div>
        <div>
          <dt>VIP arrival-to-served mean</dt>
          <dd>
            {seconds(summary.vipMeanArrivalToServedMs)} · observed served n ={" "}
            {summary.vipServedN}
          </dd>
        </div>
        <div>
          <dt>Normal arrival-to-served mean</dt>
          <dd>
            {seconds(summary.normalMeanArrivalToServedMs)} · observed served n ={" "}
            {summary.normalServedN}
          </dd>
        </div>
        <div>
          <dt>Normal Orders-to-served mean</dt>
          <dd>
            {seconds(summary.normalMeanOrdersToServedMs)} · observed served n ={" "}
            {summary.normalServedN}
          </dd>
        </div>
        <div>
          <dt>Waited during VIP activity</dt>
          <dd>
            {summary.normalWaitedDuringVipCount} normal tickets · measured
            overlap, not causal delay
          </dd>
        </div>
      </dl>
      <p>
        Arrival-to-served starts at external arrival and includes backlog
        waiting. Orders-to-served starts at admission into Orders and excludes
        external waiting. Both means use only actual served samples; an empty
        sample is N/A, not zero.
      </p>
      <p>
        VIP deadlines start at external arrival, not admission. Service at the
        deadline is on time. Burnt is separate from late; pending means arrived,
        unfinished, and not past the deadline. Late also includes unsuccessful
        manual discard.
      </p>
      <p>
        Waiting evidence: {summary.waitingDefinition}. Normal waiting overlaps
        VIP activity in Orders, ready Prep/Oven, or Pizza Box; external backlog
        is excluded. Overlap does not prove displacement.
      </p>
      <p>{DISCLAIMER}</p>
    </section>
  );
}

/** Preview-only local host. No route, legacy store, persistence, arbitrary config or synthetic evidence. */
export default function SliceOfFlowVipRound({
  difficulty,
  speed,
  onClose,
}: SliceOfFlowVipRoundProps) {
  const headingId = useId();
  const [nextDifficulty, setNextDifficulty] = useState(difficulty);
  const [nextSpeed, setNextSpeed] = useState(speed);
  const [session, setSession] = useState<IndependentSession | null>(null);
  const current = useRef<IndependentSession | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const root = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const helpButton = useRef<HTMLButtonElement>(null);
  const exitButton = useRef<HTMLButtonElement>(null);
  const firstTicket = useRef<HTMLButtonElement>(null);
  const restoreTicketFocus = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [scoreVisible, setScoreVisible] = useState(true);
  const [message, setMessage] = useState(
    "Start the FIFO baseline when your team is ready. Nothing runs before Start."
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
  const hasBaseline = retained.some(
    run => run.config.policy.variantId === "fifo"
  );
  const pilot = makeVipConfig({
    difficulty: nextDifficulty,
    variant: "fifo",
    initialSpeed: nextSpeed,
    guidedStart: true,
  });
  const start = (variant: VipVariant) => {
    if (
      current.current?.status === "active" ||
      (variant === "expedite" &&
        !current.current?.archive.runs.some(
          run => run.config.policy.variantId === "fifo"
        ))
    )
      return;
    // Randomness allocates only a fresh opaque identity, never demand or gameplay.
    const input = {
      sessionCode: `vip-${crypto.randomUUID().replaceAll("-", "").slice(0, 20)}`,
      difficulty: nextDifficulty,
      speed: nextSpeed,
      variant,
    };
    const sampledWall = wall();
    const result = current.current
      ? replayVipSession(current.current, input, sampledWall)
      : startVipSession(input, sampledWall);
    if (!result.ok) {
      setMessage(feedback(result.issues[0]?.code ?? "INVALID_START"));
      return;
    }
    commit(result.value);
    setSelected(null);
    setScoreVisible(true);
    setViewedRunId("");
    setMessage(
      `${POLICY_NAMES[variant]} started. Read the instructions, then try the first normal order.`
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
      root.current?.querySelectorAll<HTMLButtonElement>("[data-vip-ticket]") ??
        []
    ).find(element => element.dataset.vipTicket === selected);
    (ticket ?? helpButton.current)?.focus({ preventScroll: true });
  }, [session?.revision, selected]);

  const paused = !!engine?.pausedBy.length;
  const instruction = active && !!engine?.pausedBy.includes("instruction");
  const help = active && !!engine?.pausedBy.includes("help");
  const exit = active && !!engine?.pausedBy.includes("exit-confirmation");
  const guided = active && engine?.guide === "pending" && !instruction;
  const variant =
    engine?.config.policy.variantId === "expedite" ? "expedite" : "fifo";
  const orders = engine?.config.manifest.orders ?? [];
  const external = orders
    .filter(
      order =>
        engine?.tickets.find(ticket => ticket.orderKey === order.orderKey)
          ?.status === "external"
    )
    .sort(byArrival);
  const nextNormal = external.find(order => !isVip(order));
  const nextVip = external.find(isVip);
  const fifoNext = external[0];
  const normalDecision =
    engine && nextNormal
      ? applyAction(engine, { kind: "admit", orderKey: nextNormal.orderKey })
      : null;
  const vipDecision =
    engine && nextVip
      ? applyAction(engine, { kind: "admit", orderKey: nextVip.orderKey })
      : null;
  const fifoDecision =
    engine && fifoNext
      ? applyAction(engine, { kind: "admit", orderKey: fifoNext.orderKey })
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
  const activity = engine ? readVipActivity(engine) : null;
  const waiting = engine ? readCurrentNormalVipWait(engine) : null;
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
        "First normal move complete. The active kitchen clock is now running."
      );
    }
  };
  const admit = (order: DemandOrder) => {
    const result = dispatch({ kind: "admit", orderKey: order.orderKey });
    if (result?.accepted)
      setMessage(
        `${isVip(order) ? "VIP" : "Normal"} order ${order.ordinal} pulled into Orders.`
      );
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
          pairId: "vip-selected-pair",
          baselineRunId: baselineId,
          subjectRunId: subjectId,
          requestedBasis: "matched",
          change: {
            dimensionId: "vip-service",
            version: "v1",
            beforeVariantId: "fifo",
            afterVariantId: "expedite",
          },
        }
      : null;
  const assessment =
    session && pair ? assessComparison(session.archive, pair) : null;
  const baselineSnapshot = retained.find(run => run.runId === baselineId);
  const subjectSnapshot = retained.find(run => run.runId === subjectId);
  const viewedSnapshot =
    retained.find(run => run.runId === viewedRunId) ?? session?.snapshot;
  const durationConfig =
    active && engine ? engine.config : pilot.ok ? pilot.value : null;
  const displaySpeed = active && engine ? engine.speed : nextSpeed;

  return (
    <section
      ref={root}
      className="sof-independent-lab sof-vip-round"
      aria-labelledby={headingId}
      data-testid="vip-round"
      data-preview-only="true"
    >
      <header className="sof-lab-heading">
        <p className="sof-lab-eyebrow">Preview pilot · Round 3 · VIP service</p>
        <h2 id={headingId} ref={heading} tabIndex={-1}>
          Who gets the next slice?
        </h2>
        <p>
          One kitchen, two exclusive policies. Run a FIFO baseline first;
          optionally try VIP expedite after a completed baseline.
        </p>
        <p>
          {durationConfig ? (
            <>
              Active clock: {durationConfig.manifest.horizonMs / 1000} simulated
              seconds ({durationConfig.manifest.difficulty}). Ideal
              uninterrupted wall time at {displaySpeed}×:{" "}
              {format(
                durationConfig.manifest.horizonMs / 1000 / displaySpeed,
                " seconds"
              )}
              .
            </>
          ) : (
            "Pilot configuration unavailable."
          )}{" "}
          Pauses and team discussion add time; this is not a guaranteed workshop
          duration or outcome.
        </p>
        <p>
          The Round 3 pilot uses 300 simulated seconds on Normal/Hard and 420 on
          Easy. Original Round 1/2 presets are unchanged.
        </p>
        <p>
          Local memory only. No saving, uploads, accounts, or automatic sharing.
          Closing or reloading loses these retained results.
        </p>
        <SliceOfFlowAuthorCredit />
      </header>

      {!active && (
        <section
          data-testid="vip-intro"
          className="sof-vip-intro"
          aria-label="VIP pilot setup"
        >
          <h3>{session ? "Choose your next attempt" : "Start with FIFO"}</h3>
          <div className="sof-vip-policies">
            <div>
              <h3>FIFO baseline</h3>
              <p>
                Manually pull the oldest available ticket across Normal and VIP
                orders. No queue jump or extra policy slot.
              </p>
            </div>
            <div className="sof-vip-policy">
              <h3>
                <span className="sof-vip-badge">VIP</span> Expedite intervention
              </h3>
              <p>
                VIP may jump the normal backlog, earliest VIP first. Only one
                VIP can be active globally. That VIP may occupy one extra Orders
                or Pizza Box policy slot, never extra Prep or Oven capacity.
              </p>
            </div>
          </div>
          <p>
            Same physical kitchen in both policies: two Prep workers and three
            oven slots. Ordinary WIP limits: Orders 4 · Prep 2 · Oven 3 · Pizza
            Box 2. Ordinary Custom Build remains Normal, Large (Prep 90s / Oven
            80s).
          </p>
          {pilot.ok && (
            <p>
              Three Small VIPs (Prep 30s / Oven 40s) arrive at{" "}
              {pilot.value.manifest.orders
                .filter(isVip)
                .map(order => `${order.availableAtMs / 1000}s`)
                .join(", ")}{" "}
              of active clock. Each due time is measured from external arrival,
              even before you pull it.
            </p>
          )}
          <p>Missing a VIP deadline costs 2 points once. A burnt VIP costs 2 points instead of adding a second deadline penalty.</p>
          <div className="sof-lab-actions">
            <label>
              Next run difficulty{" "}
              <select
                aria-label="Next run difficulty"
                value={nextDifficulty}
                onChange={event =>
                  setNextDifficulty(event.target.value as Difficulty)
                }
              >
                <option value="easy">Easy</option>
                <option value="normal">Normal</option>
                <option value="hard">Hard</option>
              </select>
            </label>
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
          </div>
          <p>
            Settings apply only to the next fresh run. Changing difficulty or
            speed can prevent matched comparison.
          </p>
          <div className="sof-lab-actions">
            <button
              type="button"
              disabled={!pilot.ok}
              onClick={() => start("fifo")}
            >
              Start FIFO baseline
            </button>
            <button
              type="button"
              disabled={!hasBaseline || !pilot.ok}
              onClick={() => start("expedite")}
            >
              Start VIP/expedite
            </button>
            {!hasBaseline && (
              <span>
                Complete a FIFO baseline first. Manual End run records a result,
                but is not matched.
              </span>
            )}
            {onClose && (
              <button type="button" onClick={close}>
                {retained.length > 0 ? "Return to results" : "Close preview"}
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
          <nav className="sof-lab-actions" aria-label="VIP kitchen controls">
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
            <fieldset disabled={paused}>
              <legend>Kitchen speed</legend>
              {([1, 2, 3] as const).map(value => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={engine.speed === value}
                  onClick={() => dispatch({ kind: "speed", speed: value })}
                >
                  {value}×
                </button>
              ))}
            </fieldset>
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
          <p className="sof-lab-pause" data-testid="vip-pause-status">
            {paused
              ? `Kitchen paused — ${engine.pausedBy.map(reason => PAUSE_NAMES[reason]).join(", ")}.`
              : "Kitchen running."}{" "}
            Resume kitchen removes only the facilitator pause.
          </p>
          <div className="sof-lab-operational" aria-label="Kitchen operations">
            <span data-testid="vip-timer">
              Kitchen time remaining:{" "}
              {Math.max(
                0,
                Math.ceil(
                  (engine.config.manifest.horizonMs - engine.nowMs) / 1000
                )
              )}{" "}
              simulated seconds
            </span>
            <span>
              Orders left to pull:{" "}
              {
                engine.tickets.filter(
                  ticket =>
                    ticket.status === "external" ||
                    ticket.status === "scheduled"
                ).length
              }
            </span>
            {scoreVisible ? (
              <div className="sof-lab-live-score" data-testid="vip-live-scores">
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
                  Final VIP points are measured after the run, including
                  deadlines.
                </span>
              </div>
            ) : (
              <span data-testid="vip-score-hidden">Live scores hidden</span>
            )}
          </div>
          <p className="sof-lab-helper">
            {guided
              ? "First move: select Normal Order 1 with its button, Enter, or Space. Next destination: Prep. The clock waits for this valid move."
              : "Select a ticket with its button, Enter, or Space. Use the highlighted destination button or ArrowRight to move one station. Wait for Ready in Prep and Oven; watch the burn timer."}
          </p>
          <section
            className="sof-vip-backlog"
            aria-label="External VIP backlog and scheduled arrivals"
          >
            <h3>
              <span className="sof-vip-badge">VIP</span> Arrivals and deadlines
            </h3>
            <p>
              Deadlines run from external arrival, not Orders admission.{" "}
              {variant === "fifo"
                ? "FIFO: a VIP must wait behind every older available Normal ticket."
                : "Expedite: pull only the earliest available VIP when the single active token is free."}
            </p>
            <p>
              {variant === "expedite" && activity?.ok
                ? activity.value.activeVipOrderKey
                  ? `VIP token occupied by ${activity.value.activeVipOrderKey}.`
                  : "VIP token free."
                : "FIFO has no VIP queue-jump exception."}
            </p>
            <ul className="sof-vip-arrivals">
              {orders.filter(isVip).map(order => {
                const ticket = engine.tickets.find(
                  item => item.orderKey === order.orderKey
                )!;
                const decision = applyAction(engine, {
                  kind: "admit",
                  orderKey: order.orderKey,
                });
                const terminal = ["served", "burnt", "discarded"].includes(
                  ticket.status
                );
                const outcome =
                  ticket.status === "served"
                    ? ticket.exitedAtMs !== null &&
                      order.deadlineAtMs !== undefined &&
                      ticket.exitedAtMs <= order.deadlineAtMs
                      ? "Served on time"
                      : "Served late"
                    : ticket.status === "burnt"
                      ? "Burnt"
                      : ticket.status === "discarded"
                        ? "Discarded"
                        : ticket.status === "scheduled"
                          ? `Not yet arrived · arrives in ${Math.ceil((order.availableAtMs - engine.nowMs) / 1000)}s`
                          : ticket.status === "external"
                            ? "Pending in external backlog"
                            : `Active in ${STATION_NAMES[ticket.station!]}`;
                return (
                  <li key={order.orderKey}>
                    <strong>VIP Order {order.ordinal}</strong>
                    <span>{outcome}</span>
                    <span>
                      Arrival {order.availableAtMs / 1000}s · deadline{" "}
                      {order.deadlineAtMs === undefined
                        ? "Unavailable"
                        : `${order.deadlineAtMs / 1000}s`}
                      {!terminal && ` · ${deadlineText(order, engine.nowMs)}`}
                    </span>
                    {ticket.status === "external" && (
                      <button
                        type="button"
                        data-vip-admit={order.orderKey}
                        disabled={!decision.accepted}
                        onClick={() => admit(order)}
                      >
                        {variant === "fifo"
                          ? `Pull VIP Order ${order.ordinal} in FIFO order`
                          : `Pull VIP Order ${order.ordinal}`}
                      </button>
                    )}
                    {ticket.status === "external" && !decision.accepted && (
                      <span>
                        {feedback(decision.issues[0]?.code ?? "NOT_AVAILABLE")}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
          <div className="sof-lab-actions sof-vip-pull">
            {variant === "fifo" ? (
              <>
                <button
                  type="button"
                  data-vip-admit={fifoNext?.orderKey}
                  disabled={!fifoDecision?.accepted}
                  onClick={() => {
                    if (fifoNext) admit(fifoNext);
                  }}
                >
                  Pull oldest available ticket (FIFO)
                </button>
                <span>
                  {fifoNext
                    ? `Next: ${isVip(fifoNext) ? "VIP" : "Normal"} Order ${fifoNext.ordinal}. ${fifoDecision?.accepted ? "Available to pull." : feedback(fifoDecision?.issues[0]?.code ?? "PAUSED")}`
                    : "No orders available to pull."}
                </span>
              </>
            ) : (
              <>
                <button
                  type="button"
                  data-vip-admit={nextNormal?.orderKey}
                  disabled={!normalDecision?.accepted}
                  onClick={() => {
                    if (nextNormal) admit(nextNormal);
                  }}
                >
                  Pull next Normal order into Orders
                </button>
                <span>
                  {nextNormal
                    ? `Normal Order ${nextNormal.ordinal}. ${normalDecision?.accepted ? "Available to pull." : feedback(normalDecision?.issues[0]?.code ?? "PAUSED")}`
                    : "No Normal orders available."}
                </span>
                <button
                  type="button"
                  data-vip-admit={nextVip?.orderKey}
                  disabled={!vipDecision?.accepted}
                  onClick={() => {
                    if (nextVip) admit(nextVip);
                  }}
                >
                  Pull earliest VIP into Orders
                </button>
              </>
            )}
          </div>
          <div
            className="sof-vip-board"
            data-testid="vip-board"
            aria-label="Active kitchen stations and tickets"
          >
            {STATIONS.map((station, index) => {
              const exception = activity?.ok
                ? activity.value.exceptions.find(
                    item => item.station === station
                  )
                : undefined;
              return (
                <section
                  key={station}
                  style={gridPosition(index, 0, laneHeight)}
                  className={`sof-vip-lane-head sof-lab-${station} ${moveDecision?.accepted && destination === station ? "sof-vip-destination-ready" : ""}`}
                  aria-label={STATION_NAMES[station]}
                >
                  <h3>{STATION_NAMES[station]}</h3>
                  <p>
                    Occupancy: {laneCounts[index]} /{" "}
                    {engine.config.policy.wip[station]} ordinary policy slots
                  </p>
                  {(station === "prep" || station === "oven") && (
                    <p>
                      {engine.config.resources.occupancy[station]} physical{" "}
                      {station === "prep" ? "Prep workers" : "oven slots"}
                    </p>
                  )}
                  {exception && (
                    <p className="sof-vip-exception">
                      VIP exception slot occupied by {exception.orderKey} ·
                      actual occupancy {exception.occupancy} exceeds ordinary
                      limit {exception.ordinaryLimit}
                    </p>
                  )}
                  {moveDecision?.accepted && destination === station && (
                    <p>Ready destination for selected ticket</p>
                  )}
                  {laneCounts[index] === 0 && <p>No active tickets</p>}
                </section>
              );
            })}
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
                return (
                  <button
                    type="button"
                    key={ticket.orderId}
                    style={gridPosition(
                      STATIONS.indexOf(station),
                      row,
                      laneHeight
                    )}
                    className={`sof-lab-ticket sof-vip-ticket ${isVip(order) ? "sof-vip-ticket-gold" : ""}`}
                    data-vip-ticket={ticket.orderKey}
                    data-vip-station={station}
                    ref={
                      ticket.orderKey === "order-1" ? firstTicket : undefined
                    }
                    aria-pressed={selected === ticket.orderKey}
                    onClick={() => {
                      setSelected(ticket.orderKey);
                      setMessage(
                        `${isVip(order) ? "VIP" : "Normal"} Order ${order.ordinal} selected. Next destination is one station forward.`
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
                      {isVip(order) ? "VIP" : "Normal"} Order {order.ordinal} ·{" "}
                      {TYPE_NAMES[order.orderTypeId] ?? order.orderTypeId}
                    </strong>
                    <span>
                      At {STATION_NAMES[station]} · {order.complexity} · Prep{" "}
                      {order.prepMs / 1000}s · Oven {order.bakeMs / 1000}s
                    </span>
                    {station === "prep" || station === "oven" ? (
                      <span>
                        {ticket.ready
                          ? "Ready"
                          : `Working: ${Math.max(0, Math.ceil(((readyAt ?? engine.nowMs) - engine.nowMs) / 1000))}s remaining`}
                      </span>
                    ) : (
                      <span>
                        Ready to{" "}
                        {station === "boxDeliver" ? "deliver" : "move to Prep"}
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
                    {isVip(order) && (
                      <span>
                        {deadlineText(order, engine.nowMs)} · due from external
                        arrival
                      </span>
                    )}
                    {waiting?.ok && waiting.value.includes(ticket.orderKey) && (
                      <span className="sof-vip-wait-marker">Waiting during VIP activity — observed overlap, not proven delay</span>
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
          <div className="sof-lab-actions">
            <button
              type="button"
              data-vip-destination={destination ?? ""}
              className={
                moveDecision?.accepted ? "sof-vip-destination-ready" : ""
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
      {!active && viewedSnapshot && <VipResult snapshot={viewedSnapshot} />}
      {session?.status === "abandoned" && (
        <p>
          Attempt {session.attempt} abandoned. No completed snapshot exists for
          this attempt. Earlier completed results remain retained locally.
        </p>
      )}
      {!active && retained.length > 0 && (
        <>
          <section
            className="sof-vip-history"
            aria-label="Retained immutable results"
          >
            <h3>Retained results</h3>
            <p>
              Every completed attempt has a distinct immutable ID. Replays never
              replace a result.
            </p>
            <ul>
              {retained.map(run => (
                <li key={run.runId}>
                  <code>{run.runId}</code> ·{" "}
                  {run.config.policy.variantId === "fifo"
                    ? "FIFO baseline"
                    : "VIP expedite"}{" "}
                  · {run.config.manifest.difficulty} · {run.config.initialSpeed}
                  × · {run.endReason}
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
            data-testid="vip-comparison"
            aria-label="Explicit VIP run comparison"
          >
            <h3>Choose comparison IDs</h3>
            <p>
              No latest or best pair is selected automatically. Choose a
              retained FIFO ID and a distinct retained expedite ID.
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
                    .filter(run => run.config.policy.variantId === "fifo")
                    .map(run => (
                      <option value={run.runId} key={run.runId}>
                        {run.runId}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Expedite attempt{" "}
                <select
                  aria-label="Expedite attempt"
                  value={subjectId}
                  onChange={event => setSubjectId(event.target.value)}
                >
                  <option value="">Choose an expedite ID</option>
                  {retained
                    .filter(
                      run =>
                        run.config.policy.variantId === "expedite" &&
                        run.runId !== baselineId
                    )
                    .map(run => (
                      <option value={run.runId} key={run.runId}>
                        {run.runId}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            {assessment ? (
              <>
                <h3>
                  {assessment.kind === "matched"
                    ? "Matched conditions"
                    : "Not matched"}
                </h3>
                <p>
                  Basis: {assessment.kind}. Requested dimension: vip-service/v1
                  · FIFO → expedite.
                </p>
                <p>
                  Explicit baseline: <code>{assessment.baselineRunId}</code> ·
                  expedite: <code>{assessment.subjectRunId}</code>.
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
                <p>
                  Only canonical assessComparison evaluates scenario, demand,
                  physics, difficulty, speed, guidance, observation window, end
                  reason, and accepted control traces. Manual ends are not
                  matched, even at equal durations.
                </p>
              </>
            ) : (
              <p>Comparison not selected. Both ID choices start empty.</p>
            )}
            {baselineSnapshot && subjectSnapshot && (
              <SliceOfFlowVipComparisonTable baseline={baselineSnapshot} subject={subjectSnapshot} />
            )}
            <p>{DISCLAIMER}</p>
            {baselineId && subjectId && (
              <div className="sof-vip-pair-results">
                {retained
                  .filter(
                    run => run.runId === baselineId || run.runId === subjectId
                  )
                  .map(run => (
                    <VipResult key={run.runId} snapshot={run} />
                  ))}
              </div>
            )}
          </section>
          <section className="sof-vip-debrief" aria-label="Team debrief">
            <h3>Bring the rule back to work</h3>
            <ol>
              <li>What would happen if every order were VIP?</li>
              <li>
                Who has authority to declare urgency, and what cost or waiting
                did the team actually observe?
              </li>
              <li>
                What one team rule would govern the equivalent expedite lane in
                your real work?
              </li>
            </ol>
            <p>
              Discuss observed evidence, not an assumed lesson. One pair is not
              an outcome distribution or a guarantee.
            </p>
          </section>
        </>
      )}
      <SliceOfFlowDialog
        open={!!instruction}
        title="VIP pilot instructions"
        description="Read the policy and try the first normal order. The clock is paused."
        onDismiss={() => closeOwner("instruction")}
        onReturnFocus={() => firstTicket.current?.focus()}
      >
        <div className="sof-lab-dialog sof-vip-dialog">
          <h2>{POLICY_NAMES[variant]} instructions</h2>
          <p>
            Pull available orders. FIFO takes the oldest ticket; expedite can
            pull the earliest VIP with one active VIP globally. Select a ticket,
            then move one station forward. Wait for Ready in Prep and Oven;
            avoid burns. VIP deadlines start at external arrival. Instructions
            and your first normal Orders-to-Prep move pause the clock.
          </p>
          <button
            type="button"
            data-dialog-initial
            onClick={() => closeOwner("instruction")}
          >
            Try first order
          </button>
        </div>
      </SliceOfFlowDialog>
      <SliceOfFlowDialog
        open={!!help}
        title="VIP kitchen help"
        description="Keyboard controls, policy limits, hazards and pause ownership."
        onDismiss={() => closeOwner("help")}
        onReturnFocus={() => helpButton.current?.focus()}
      >
        <div className="sof-lab-dialog sof-vip-dialog">
          <h2>How to play</h2>
          <p>
            Use native ticket buttons, Enter, or Space to select. Use the
            destination button or ArrowRight on the selected ticket to move one
            station. Prep and Oven require Ready. Move baked tickets before
            their burn timer expires.
          </p>
          <p>
            FIFO pulls oldest available across all classes. Expedite permits the
            earliest available VIP to jump Normal backlog, with only one active
            VIP globally and one extra Orders or Pizza Box policy slot for that
            VIP. No extra Prep worker or oven slot is created.
          </p>
          <p>
            Resume kitchen removes only the facilitator pause. Help,
            instructions, guide, hidden tab, and exit confirmation own separate
            pauses. These controls never affect the original kitchen.
          </p>
          <SliceOfFlowOrderGuide compact headingLevel={3} />
          <p>
            VIPs in this pilot are separately labeled Small orders. Custom Build
            is still Normal and Large.
          </p>
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
        title="Abandon this VIP run?"
        description="Exit confirmation pauses the kitchen. Confirming abandons without a completed snapshot."
        onDismiss={() => closeOwner("exit-confirmation")}
        onReturnFocus={() => exitButton.current?.focus()}
      >
        <div className="sof-lab-dialog sof-vip-dialog">
          <h2>Abandon this run?</h2>
          <p>
            Confirming discards this active attempt without recording a
            completed result. Cancel removes only the exit-confirmation pause.
            Earlier completed results remain local until the preview closes.
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
