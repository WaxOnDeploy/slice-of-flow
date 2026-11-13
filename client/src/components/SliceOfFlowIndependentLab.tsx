import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import SliceOfFlowDialog from './SliceOfFlowDialog';
import SliceOfFlowAuthorCredit from './SliceOfFlowAuthorCredit';
import SliceOfFlowOrderGuide from './SliceOfFlowOrderGuide';
import {
  abandonIndependentSession, commandIndependentSession, exitConfirmationCommand, facilitatorCommand,
  integerWallUs, replayIndependentSession, sampleIndependentSession, sessionToken,
  startIndependentSession, visibilityCommand, type IndependentSession,
} from '@/lib/sof/independentSession';
import { applyAction } from '@/lib/sofEngine/engine';
import { scoreCounts } from '@/lib/sofEngine/scenario';
import { STATIONS, type Difficulty, type EngineCommand, type RunArchive, type Speed, type Station, type Ticket } from '@/lib/sofEngine/types';
import '@/lib/sliceOfFlowIndependentLab.css';

export interface SliceOfFlowIndependentLabProps {
  difficulty: Difficulty;
  speed: Speed;
  onClose?: () => void;
  /** Optional caller-allocated fresh non-personal code for the first run; no editable label. */
  sessionCode?: string;
  /** Read-only parent disclosure seam. Only a newly finalized frozen archive is notified. */
  onArchiveChange?: (archive: RunArchive) => void;
}
const STATION_NAMES: Record<Station, string> = { orderQueue: 'Orders', prep: 'Prep', oven: 'Oven', boxDeliver: 'Pizza Box' };
const TYPE_NAMES: Record<string, string> = { cheese: 'Cheese', pepperoni: 'Pepperoni', 'veggie-supreme': 'Veggie Supreme', 'meat-lovers': 'Meat Lovers', 'custom-build': 'Custom Build' };
const PAUSE_NAMES = { instruction: 'instructions', guide: 'first-order guide', help: 'help', facilitator: 'facilitator', transition: 'transition', 'exit-confirmation': 'exit confirmation', hidden: 'hidden tab' };
const number = (v: number | null, unit = '') => v === null ? 'Unavailable' : `${v.toFixed(2).replace(/\.00$/, '')}${unit}`;
function feedback(code: string): string {
  const messages: Record<string, string> = {
    PAUSED: 'Kitchen paused. Close the owning dialog or use Resume lab for the facilitator lock.',
    CAPACITY: 'Destination is full. Move a ready ticket out to make room, then try again.',
    NOT_READY: 'This ticket is still working. Wait for Ready before moving it.',
    FIFO: 'Pull the next available order first.', NOT_AVAILABLE: 'That order is no longer available to pull.',
    NOT_ACTIVE: 'That ticket has left the active kitchen. Select another ticket.',
    INVALID_MOVE: 'Move only to the next station.', STALE_SESSION: 'The run changed. Try the action again.',
    ENDED: 'The observation reached its horizon. Its actual final snapshot is shown below.',
    FRESH_SESSION_REQUIRED: 'Replay needs a fresh generic session code.', INVALID_ID: 'Use a fresh generic session code supplied by the preview host.',
  };
  return messages[code] ?? `Action not accepted (${code}). The run was not changed.`;
}
/** No route, auto-start, legacy store, export seam, optional registry or external service. */
export default function SliceOfFlowIndependentLab({ difficulty, speed, onClose, sessionCode, onArchiveChange }: SliceOfFlowIndependentLabProps) {
  const headingId = useId();
  const [session, setSession] = useState<IndependentSession | null>(null);
  const current = useRef<IndependentSession | null>(null);
  const notifiedArchive = useRef<RunArchive | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const labRoot = useRef<HTMLElement>(null);
  const returnTicketFocus = useRef(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [scoreVisible, setScoreVisible] = useState(true);
  const [message, setMessage] = useState('Start when you are ready. This lab does not control the original kitchen.');
  const helpButton = useRef<HTMLButtonElement>(null);
  const exitButton = useRef<HTMLButtonElement>(null);
  const firstTicket = useRef<HTMLButtonElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const cancelSchedule = useCallback(() => {
    if (timer.current !== null) { clearTimeout(timer.current); timer.current = null; }
  }, []);
  const wall = useCallback(() => integerWallUs(performance.now(), current.current?.driver.lastWallUs ?? null), []);
  const commit = useCallback((next: IndependentSession) => {
    if (next === current.current) return;
    cancelSchedule(); current.current = next; setSession(next);
  }, [cancelSchedule]);
  const dispatch = useCallback((command: EngineCommand, sampledWall?: number) => {
    const state = current.current;
    if (!state || state.status !== 'active') return null;
    const result = commandIndependentSession(state, sessionToken(state), sampledWall ?? wall(), command);
    commit(result.state);
    if (!result.accepted) setMessage(feedback(result.issues[0]?.code ?? 'INVALID_COMMAND'));
    return result;
  }, [commit, wall]);
  const start = () => {
    // Fresh IDs are local opaque codes. Randomness is identity-only, never deck generation.
    const code = !current.current && sessionCode ? sessionCode : `lab-${crypto.randomUUID().replaceAll('-', '').slice(0, 20)}`;
    const input = { sessionCode: code, difficulty, speed };
    const sample = wall();
    const result = current.current ? replayIndependentSession(current.current, input, sample) : startIndependentSession(input, sample);
    if (!result.ok) { setMessage(feedback(result.issues[0]?.code ?? 'INVALID_START')); return; }
    commit(result.value); setSelected(null); setScoreVisible(true); setMessage('Read the instructions, then select the first order.');
    // A run explicitly started while hidden must remain paused when instructions close.
    if (document.hidden) dispatch(visibilityCommand(true), sample);
  };
  useEffect(() => {
    const state = current.current;
    // Exactly one scheduled loop, only after Start and only during unpaused active play.
    if (!state || state.status !== 'active' || state.engine.pausedBy.length) return;
    const token = sessionToken(state);
    timer.current = setTimeout(() => {
      timer.current = null;
      const latest = current.current;
      if (!latest) return;
      const result = sampleIndependentSession(latest, token, wall());
      if (result.accepted) commit(result.state);
      else if (result.issues[0]?.code !== 'STALE_SESSION') setMessage(feedback(result.issues[0]?.code ?? 'INVALID_SAMPLE'));
    }, 100);
    return cancelSchedule;
  }, [session?.runId, session?.revision, session?.status, commit, cancelSchedule, wall]);
  useEffect(() => {
    if (session?.status !== 'active') return;
    const visibility = () => {
      if (document.hidden) cancelSchedule();
      // Hide flushes visible elapsed time under old mode. Show rebases while hidden before unlock.
      dispatch(visibilityCommand(document.hidden));
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, [session?.runId, session?.status, dispatch, cancelSchedule]);
  useEffect(() => {
    if (session?.status !== 'active') return;
    const pageExit = () => {
      cancelSchedule();
      const state = current.current;
      if (state?.status === 'active') commit(abandonIndependentSession(state, sessionToken(state), 'unmount').state);
    };
    window.addEventListener('pagehide', pageExit);
    return () => window.removeEventListener('pagehide', pageExit);
  }, [session?.runId, session?.status, commit, cancelSchedule]);
  useEffect(() => () => {
    cancelSchedule();
    const state = current.current;
    if (state?.status === 'active') current.current = abandonIndependentSession(state, sessionToken(state), 'unmount').state;
    // This host is intentionally silent: no audio context, pending audio or historical sounds exist.
  }, [cancelSchedule]);
  useEffect(() => {
    if (session?.status === 'final' || session?.status === 'abandoned') heading.current?.focus({ preventScroll: true });
  }, [session?.status]);
  useEffect(() => {
    if (session?.status !== 'final' || !session.snapshot || session.archive === notifiedArchive.current || !onArchiveChange) return;
    notifiedArchive.current = session.archive;
    onArchiveChange(session.archive);
  }, [session?.status, session?.snapshot, session?.archive, onArchiveChange]);
  useLayoutEffect(() => {
    if (!returnTicketFocus.current) return;
    returnTicketFocus.current = false;
    const ticket = Array.from(labRoot.current?.querySelectorAll<HTMLButtonElement>('[data-lab-ticket]') ?? [])
      .find(element => element.dataset.labTicket === selected);
    (ticket ?? helpButton.current)?.focus({ preventScroll: true });
  }, [session?.revision, selected]);
  const active = session?.status === 'active';
  const engine = session?.engine;
  const paused = !!engine?.pausedBy.length;
  const instruction = active && !!engine?.pausedBy.includes('instruction');
  const help = active && !!engine?.pausedBy.includes('help');
  const exit = active && !!engine?.pausedBy.includes('exit-confirmation');
  const guided = active && engine?.guide === 'pending' && !instruction;
  const selectedTicket = engine?.tickets.find(t => t.orderKey === selected && t.status === 'active');
  const destination = selectedTicket?.station ? [...STATIONS, 'served' as const][STATIONS.indexOf(selectedTicket.station) + 1] : null;
  const plannedMove: EngineCommand | null = selectedTicket && destination ? { kind: 'move', orderKey: selectedTicket.orderKey, to: destination } : null;
  const moveDecision = engine && plannedMove ? applyAction(engine, plannedMove) : null;
  const nextOrder = engine?.tickets.find(t => t.status === 'external');
  const pullDecision = engine && nextOrder ? applyAction(engine, { kind: 'admit', orderKey: nextOrder.orderKey }) : null;
  const moveSelected = (retainTicketFocus = false) => {
    if (!plannedMove) return;
    const sample = wall();
    const result = dispatch(plannedMove, sample);
    if (result?.accepted) {
      returnTicketFocus.current = retainTicketFocus;
      setMessage(destination === 'served' ? 'Ticket delivered. Pull or select another order.' : `Moved to ${STATION_NAMES[destination as Station]}.`);
      if (result.state.engine.guide === 'moved') {
        dispatch({ kind: 'set-pause', reason: 'guide', active: false }, sample);
        setMessage('First move complete. Pull orders when there is room; move ready tickets one station at a time.');
      }
    }
  };
  const selectTicket = (ticket: Ticket) => { setSelected(ticket.orderKey); setMessage(`Order ${engine?.config.manifest.orders.find(o => o.orderKey === ticket.orderKey)?.ordinal} selected. Use the destination button or ArrowRight to move.`); };
  const closeOwner = (reason: 'instruction' | 'help' | 'exit-confirmation') => dispatch({ kind: 'set-pause', reason, active: false });
  const close = () => {
    if (active) dispatch(exitConfirmationCommand(true));
    else onClose?.();
  };
  const confirmExit = () => {
    const state = current.current;
    if (!state) return;
    const result = abandonIndependentSession(state, sessionToken(state), 'confirmed-exit');
    if (result.accepted) { commit(result.state); setMessage('Run abandoned. No final result was recorded for this attempt.'); onClose?.(); }
  };
  const served = engine?.tickets.filter(t => t.status === 'served').length ?? 0;
  const burnt = engine?.tickets.filter(t => t.status === 'burnt').length ?? 0;
  const angry = engine?.tickets.filter(t => t.angry && t.status !== 'burnt' && t.admittedAtMs !== null).length ?? 0;
  const measured = session?.measured;
  return <section ref={labRoot} className="sof-independent-lab" aria-labelledby={headingId} data-testid="independent-lab" data-preview-only="true">
    <header className="sof-lab-heading">
      <p className="sof-lab-eyebrow">Preview only · independent measurement lab</p>
      <h2 id={headingId} ref={heading} tabIndex={-1}>One kitchen, one independent run</h2>
      <p>Fixed deck · manual pull · {engine?.config.manifest.difficulty ?? difficulty} · {engine?.speed ?? speed}× kitchen clock</p>
      <p>This is not an original-game round or a baseline comparison. Lab controls affect only this independent run.</p>
      <p>Local memory only. No saving, accounts, uploads, or automatic result sharing. Closing or reloading loses this lab history.</p>
      <SliceOfFlowAuthorCredit />
    </header>
    {!session && <div className="sof-lab-actions"><button type="button" onClick={start}>Start lab run</button>{onClose && <button type="button" onClick={onClose}>Close preview</button>}</div>}
    {active && engine && <>
      <nav className="sof-lab-actions" aria-label="Independent kitchen controls">
        <button type="button" onClick={() => dispatch(facilitatorCommand(!engine.pausedBy.includes('facilitator')))}>{engine.pausedBy.includes('facilitator') ? 'Resume lab' : 'Pause lab'}</button>
        <button type="button" ref={helpButton} onClick={() => dispatch({ kind: 'set-pause', reason: 'help', active: true })}>Help</button>
        <button type="button" onClick={() => setScoreVisible(v => !v)}>{scoreVisible ? 'Hide live scores' : 'Show live scores'}</button>
        <fieldset disabled={paused}><legend>Kitchen speed</legend>{([1, 2, 3] as const).map(v => <button type="button" key={v} aria-pressed={engine.speed === v} onClick={() => dispatch({ kind: 'speed', speed: v })}>{v}×</button>)}</fieldset>
        <button type="button" disabled={paused} onClick={() => dispatch({ kind: 'end', reason: 'manual-stop' })}>End lab run</button>
        <button type="button" ref={exitButton} onClick={close}>Leave lab</button>
      </nav>
      <p className="sof-lab-pause" data-testid="lab-pause-status">{paused ? `Kitchen paused — ${engine.pausedBy.map(p => PAUSE_NAMES[p]).join(', ')}.` : 'Kitchen running.'} Resume lab removes only the facilitator pause.</p>
      <div className="sof-lab-operational" aria-label="Kitchen operations">
        <span data-testid="lab-timer">Kitchen time remaining: {Math.ceil((engine.config.manifest.horizonMs - engine.nowMs) / 1000)} simulated seconds</span>
        <span>Orders left to pull: {engine.tickets.filter(t => t.status === 'external' || t.status === 'scheduled').length}</span>
        {scoreVisible ? <div data-testid="lab-live-scores" className="sof-lab-live-score"><span>Served: {served}</span><span>Burnt: {burnt}</span><span>Angry: {angry}</span><span>Points: {scoreCounts(served, burnt, angry)}</span></div> : <span data-testid="lab-score-hidden">Live score hidden</span>}
      </div>
      <p className="sof-lab-helper">{guided ? (selected === 'order-1' ? 'First order selected. Move it to Prep using the destination button or ArrowRight.' : 'First move: select Order 1 with its button, Enter, or Space. Next destination: Prep. The clock waits for this move.') : 'Select a ticket with its button, Enter, or Space. Move one station with the destination button or ArrowRight. Wait for Ready at Prep and Oven. Pull only when Orders has room.'}</p>
      <div className="sof-lab-actions">
        <button type="button" disabled={!pullDecision?.accepted} onClick={() => { if (nextOrder) { const r = dispatch({ kind: 'admit', orderKey: nextOrder.orderKey }); if (r?.accepted) setMessage('Next order pulled into Orders.'); } }}>Pull next order into Orders</button>
        <span>{!nextOrder ? 'No orders left to pull.' : !pullDecision?.accepted ? feedback(pullDecision?.issues[0]?.code ?? 'PAUSED') : 'Orders has room for the next ticket.'}</span>
      </div>
      <div className="sof-lab-stations" aria-label="Active kitchen stations">
        {STATIONS.map(station => {
          const tickets = engine.tickets.filter(t => t.status === 'active' && t.station === station);
          return <section className={`sof-lab-station sof-lab-${station}`} aria-label={STATION_NAMES[station]} key={station}>
            <h3>{STATION_NAMES[station]}</h3><p>Capacity: {tickets.length}/{engine.config.policy.wip[station]}</p>
            {station === 'oven' && <p>Three physical oven slots</p>}
            {tickets.length === 0 && <p>No active tickets</p>}
            {tickets.map(ticket => {
              const order = engine.config.manifest.orders.find(o => o.orderKey === ticket.orderKey)!;
              const readyAt = station === 'prep' ? ticket.prepReadyAtMs : ticket.ovenReadyAtMs;
              return <button type="button" className="sof-lab-ticket" data-lab-ticket={ticket.orderKey} key={ticket.orderId} ref={ticket.orderKey === 'order-1' ? firstTicket : undefined}
                aria-pressed={selected === ticket.orderKey} onClick={() => selectTicket(ticket)} onKeyDown={event => {
                  if (event.key === 'ArrowRight' && selected === ticket.orderKey) { event.preventDefault(); moveSelected(true); }
                }}>
                <strong>Order {order.ordinal} · {TYPE_NAMES[order.orderTypeId] ?? order.orderTypeId}</strong>
                <span>{order.complexity} · Prep {order.prepMs / 1000}s · Oven {order.bakeMs / 1000}s</span>
                {(station === 'prep' || station === 'oven') && <span>{ticket.ready ? 'Ready' : `Working: ${Math.max(0, Math.ceil(((readyAt ?? engine.nowMs) - engine.nowMs) / 1000))}s remaining`}</span>}
                {station === 'oven' && <span>Burn hazard: {Math.max(0, Math.ceil(((ticket.burnAtMs ?? engine.nowMs) - engine.nowMs) / 1000))}s until burn</span>}
                <span>Ticket age: {Math.floor((engine.nowMs - (ticket.admittedAtMs ?? engine.nowMs)) / 1000)}s{ticket.angry ? ' · Customer angry' : ''}</span>
              </button>;
            })}
          </section>;
        })}
      </div>
      <div className="sof-lab-actions">
        <button type="button" data-lab-destination disabled={!moveDecision?.accepted} onClick={() => moveSelected()}>{destination ? (destination === 'served' ? 'Deliver selected ticket' : `Move selected ticket to ${STATION_NAMES[destination]}`) : 'Select a ticket to move'}</button>
        <span>{selectedTicket && !moveDecision?.accepted ? feedback(moveDecision?.issues[0]?.code ?? 'INVALID_MOVE') : selectedTicket ? 'Valid next destination.' : 'No active ticket selected.'}</span>
      </div>
    </>}
    <p className="sof-lab-feedback" role="status" aria-live="polite" aria-atomic="true">{message}</p>
    {session?.status === 'final' && session.snapshot && measured && <section className="sof-lab-final" data-testid="lab-results" aria-label="Actual independent run measurements">
      <h3>Independent run recorded</h3><p>Attempt {session.attempt} · {session.runId} · {session.snapshot.endReason}</p>
      <p>Actual observation duration: {number(measured.durationSimSec, ' simulated seconds')}. Source: {measured.source} · complete engine ledger.</p>
      <p>Population: every active ticket from Orders admission to terminal exit; external waiting is excluded.</p>
      <dl>
        <div><dt>Served / Burnt / Angry / Points</dt><dd>{session.snapshot.metrics.served} / {session.snapshot.metrics.burnt} / {session.snapshot.metrics.angry} / {session.snapshot.metrics.score}</dd></div>
        <div><dt>Measured average WIP</dt><dd>{number(measured.averageWip, ' tickets')}</dd></div>
        <div><dt>Delivery rate (served only)</dt><dd>{number(measured.deliveryRatePerSimMinute, ' tickets per simulated minute')}</dd></div>
        <div><dt>All-exit rate (served + discarded, including burns)</dt><dd>{number(measured.allExitRatePerSimMinute, ' exits per simulated minute')}</dd></div>
        <div><dt>Measured Orders-to-served average</dt><dd>{number(measured.measuredOrdersToServedSimSec, ' simulated seconds')} · served sample n = {measured.measuredServedSampleCount}</dd></div>
        <div><dt>Unfinished tickets at observation end</dt><dd>{measured.unfinished.length}</dd></div>
      </dl>
      <h3>Orders-to-exit illustration — separate from measured served time</h3>
      <p>{number(measured.illustrativeOrdersToExitSimSec, ' simulated seconds')} · active area {number(measured.areaTicketSec, ' ticket-seconds')} / {measured.exitCount} actual exits.</p>
      <p>{measured.caveat}</p><p>{measured.exitRateDistinction}</p>
      <p>No original-game telemetry or matched baseline is used. Results may be mixed, equal, adverse, or unavailable; they do not establish a causal lesson.</p>
    </section>}
    {session?.status === 'abandoned' && <p>Attempt {session.attempt} abandoned. No completed snapshot exists for this attempt.</p>}
    {session && !active && <div className="sof-lab-actions"><button type="button" onClick={start}>Replay lab run</button>{onClose && <button type="button" onClick={onClose}>Close preview</button>}</div>}
    <SliceOfFlowDialog open={!!instruction} title="Independent lab instructions" description="Read the manual-pull kitchen instructions, then try the first order." onDismiss={() => closeOwner('instruction')} onReturnFocus={() => firstTicket.current?.focus()}>
      <div className="sof-lab-dialog"><h2>Welcome to the independent kitchen</h2><p>Pull from the fixed deck when Orders has room. Select a ticket, then move it one station forward. Prep and Oven must finish before moving; oven tickets can burn. The clock is paused for instructions and your first Orders-to-Prep move.</p><SliceOfFlowOrderGuide compact headingLevel={3} /><button type="button" data-dialog-initial onClick={() => closeOwner('instruction')}>Try the first order</button></div>
    </SliceOfFlowDialog>
    <SliceOfFlowDialog open={!!help} title="How to play the independent lab" description="Manual pull, keyboard controls, capacity and pause ownership." onDismiss={() => closeOwner('help')} onReturnFocus={() => helpButton.current?.focus()}>
      <div className="sof-lab-dialog"><h2>How to play</h2><p>Use a ticket button, Enter, or Space to select. Use the destination button or ArrowRight on the selected ticket to move one station. Pull the next order when Orders has room. Prep and Oven require Ready. Move baked tickets before their burn hazard expires.</p><p>Pause lab belongs to the facilitator. Resume lab removes only that lock. Help, instructions, the first-order guide, a hidden tab, and exit confirmation keep their own pauses. Lab controls do not pause the original game.</p><SliceOfFlowOrderGuide compact headingLevel={3} /><button type="button" data-dialog-initial onClick={() => closeOwner('help')}>Close help</button></div>
    </SliceOfFlowDialog>
    <SliceOfFlowDialog open={!!exit} title="Abandon this independent run?" description="Exit confirmation pauses this lab only. Confirming abandons the draft without recording a completed result." onDismiss={() => closeOwner('exit-confirmation')} onReturnFocus={() => exitButton.current?.focus()}>
      <div className="sof-lab-dialog"><h2>Abandon this run?</h2><p>The lab is paused for this confirmation. Exit discards the active draft, not a completed result. Cancel removes only the exit-confirmation pause.</p><button type="button" data-dialog-initial onClick={() => closeOwner('exit-confirmation')}>Cancel exit</button><button type="button" onClick={confirmExit}>Abandon run and exit</button></div>
    </SliceOfFlowDialog>
  </section>;
}
