import { describe, expect, it } from 'vitest';
import { createArchive, createRunDraft, finalizeRun, getRun, makeOrderId, makeRunId, retainRun, snapshotFromEngine, validateSnapshot } from './runSnapshots';
import { action, admit, at, clone, move, resume, start, testConfig, value } from './fixtures/testCases';
import type { Engine } from './types';
function servedRun(runId = 'session:run:1'): Engine {
  let s = move(admit(resume(start(testConfig({ count: 1 }), runId)), 1), 1, 'prep');
  s = move(at(s, 3), 1, 'oven'); s = move(at(s, 7), 1, 'boxDeliver'); s = move(s, 1, 'served'); return at(s, 50);
}

describe('run identity and capture', () => {
  it('caller allocates non-personal local codes and positive ordinals without time/randomness', () => {
    expect(value(makeRunId('session_A', 2))).toBe('session_A:run:2');
    expect(value(makeOrderId('session_A:run:2', 12))).toBe('session_A:run:2:order:12');
    for (const x of [0, -1, 0.2, NaN, '1']) {
      expect(makeRunId('session', x).ok).toBe(false); expect(makeOrderId('session:run:1', x).ok).toBe(false);
    }
    expect(makeRunId('a personal label', 1).ok).toBe(false); expect(makeRunId('a@b.com', 1).ok).toBe(false);
    expect(makeRunId('x'.repeat(33), 1).ok).toBe(false); expect(makeOrderId('x'.repeat(65), 1).ok).toBe(false);
  });
  it('draft capture copies config and refuses live/not-ended capture', () => {
    const config: any = clone(testConfig()); const draft = value(createRunDraft('r', config));
    config.manifest.orders[0].prepMs = 1000;
    expect(draft.config.manifest.orders[0].prepMs).toBe(3); expect(draft.final).toBeNull(); expect(Object.isFrozen(draft.config.manifest.orders)).toBe(true);
    expect(finalizeRun(draft, start(draft.config, 'r'))).toMatchObject({ ok: false, issues: [{ code: 'NOT_ENDED' }] });
    expect(createRunDraft('invalid name', config).ok).toBe(false);
  });
  it('finalizes complete event-boundary observation with exact sample n/sum/mean and real end', () => {
    const engine = servedRun(); const draft = value(createRunDraft(engine.runId, engine.config));
    const finalized = value(finalizeRun(draft, engine));
    expect(draft.final).toBeNull();
    expect(finalized.snapshot).toMatchObject({ schema: 'sof-run/v1', kind: 'independent-final',
      observation: { startMs: 0, endMs: 50, durationMs: 50 }, endReason: 'horizon',
      history: { schema: 'sof-history/v1', source: 'engine-boundary', completeness: 'complete' },
      metrics: { served: 1, burnt: 0, angry: 0, stillInProgress: 0, score: 4,
        servedSample: { definition: 'orders-to-served/nonnegative-elapsed/v1', n: 1, sumSimMs: 7, meanSimMs: 7 } } });
    expect(finalized.snapshot.history.events).toEqual(engine.events);
    expect(Object.isFrozen(finalized.snapshot.history.events[1])).toBe(true);
    expect(Object.isFrozen(finalized.snapshot.orders[0])).toBe(true); expect(Object.isFrozen(finalized.snapshot.metrics.servedSample)).toBe(true);
    expect(value(finalizeRun(finalized.draft, engine)).draft).toBe(finalized.draft);
    expect(value(finalizeRun(finalized.draft, engine)).snapshot).toBe(finalized.snapshot);
  });
  it('first accepted completion wins; a different actual window/reason is conflicting', () => {
    const config = testConfig({ count: 1 }); const original = at(resume(start(config, 'r')), 50);
    const finalized = value(finalizeRun(value(createRunDraft('r', config)), original));
    let other = at(resume(start(config, 'r')), 10); other = action(other, { kind: 'end', reason: 'manual-stop' });
    expect(finalizeRun(finalized.draft, other)).toMatchObject({ ok: false, issues: [{ code: 'FINALIZATION_CONFLICT' }] });
    expect(finalized.snapshot.observation.endMs).toBe(50);
    expect(finalizeRun(value(createRunDraft('different', config)), original).ok).toBe(false);
    expect(finalizeRun({ ...finalized.draft, personal: 'x' }, original).ok).toBe(false);
  });
  it('replay integrity detects coherent-but-forged state/event physics, rather than generating a fixture oracle', () => {
    const engine = servedRun(); const forged: any = clone(engine);
    // Shift the prep-ready boundary; independent expected physics is 3ms, not 2ms.
    const ready = forged.events.find((e: any) => e.kind === 'ready' && e.station === 'prep'); ready.atMs = 2;
    expect(snapshotFromEngine(forged)).toMatchObject({ ok: false, issues: [{ code: 'ENGINE_REPLAY_MISMATCH' }] });
    const bad: any = clone(engine); bad.tickets[0].angry = true;
    expect(snapshotFromEngine(bad).ok).toBe(false);
  });
  it('synthetic score parity includes angry active/served/manual-discarded but excludes burnt-angry', () => {
    const config = testConfig({ count: 3, patienceMs: 10, horizonMs: 50 });
    let s = resume(start(config));
    s = move(admit(s, 1), 1, 'prep'); s = move(admit(s, 2), 2, 'prep'); s = admit(s, 3);
    s = at(s, 3); s = move(s, 1, 'oven'); s = move(s, 2, 'oven');
    s = move(at(s, 7), 1, 'boxDeliver'); s = move(s, 1, 'served');
    s = at(s, 50);
    // +1 served -2 burnt -1 angry surviving ticket; no zero-burn bonus = -2.
    const snapshot = value(snapshotFromEngine(s));
    expect(snapshot.metrics).toMatchObject({ served: 1, burnt: 1, angry: 1, stillInProgress: 1, score: -2 });
    expect(snapshot.orders[1]).toMatchObject({ outcome: 'burnt', angry: true });
    expect(snapshot.orders[2]).toMatchObject({ outcome: 'active', angry: true });
    let discarded = admit(resume(start(testConfig({ count: 1, patienceMs: 10 }))), 1);
    discarded = action(at(discarded, 12), { kind: 'discard', orderKey: 'order-1' }); discarded = at(discarded, 50);
    expect(value(snapshotFromEngine(discarded)).metrics).toMatchObject({ served: 0, burnt: 0, angry: 1, stillInProgress: 0, score: -1 });
    expect(value(snapshotFromEngine(at(resume(start(testConfig({ count: 0 }))), 50))).metrics.score).toBe(0);
  });
});

describe('snapshot validation closes malformed recording', () => {
  it.each([
    (s: any) => { s.metrics.score += 1; }, (s: any) => { s.metrics.servedSample.n = 9; },
    (s: any) => { s.metrics.servedSample.sumSimMs = 8; }, (s: any) => { s.metrics.servedSample.meanSimMs = 8; },
    (s: any) => { s.metrics.servedSample.definition = 'orders-to-served/positive-usable/v1'; },
    (s: any) => { s.orders[0].exitedAtMs = 8; }, (s: any) => { s.orders[0].outcome = 'burnt'; },
    (s: any) => { s.orders[0].orderId = 'other'; }, (s: any) => { s.observation.durationMs = 51; },
    (s: any) => { s.observation.startMs = 1; }, (s: any) => { s.history = null; },
    (s: any) => { s.history.completeness = 'unknown'; }, (s: any) => { s.history.events = []; },
    (s: any) => { s.config.resources.occupancy.oven = 4; }, (s: any) => { s.endReason = 'service-bell'; },
    (s: any) => { s.customer = 'x'; }, (s: any) => { s.metrics.customer = 'x'; },
  ])('rejects mismatched/unknown snapshot %#', mutate => {
    const raw = clone(value(snapshotFromEngine(servedRun()))); mutate(raw); expect(validateSnapshot(raw).ok).toBe(false);
  });
  it('validates newly owned snapshot, not caller objects', () => {
    const input: any = clone(value(snapshotFromEngine(servedRun()))); const checked = value(validateSnapshot(input));
    input.history.events[0].atMs = 999;
    expect(checked.history.events[0].atMs).toBe(0); expect(Object.isFrozen(checked.history.events[0])).toBe(true);
  });
});

describe('append-only local archive', () => {
  it('retains old archive/history across new attempts with independent run/order IDs', () => {
    const empty = createArchive(); const first = value(snapshotFromEngine(servedRun('session:run:1')));
    const archive1 = value(retainRun(empty, first)); const second = value(snapshotFromEngine(servedRun('session:run:2')));
    const archive2 = value(retainRun(archive1, second));
    expect(empty.runs).toEqual([]); expect(archive1.runs).toHaveLength(1); expect(archive2.runs).toHaveLength(2);
    expect(value(getRun(archive2, 'session:run:1'))).toEqual(first); expect(value(getRun(archive2, 'missing'))).toBeNull();
    expect(first.orders[0].orderId).not.toBe(second.orders[0].orderId);
    expect(value(retainRun(archive2, first))).toBe(archive2); expect(Object.isFrozen(archive2.runs)).toBe(true);
    expect(archive1.runs[0].history.events).toEqual(first.history.events);
  });
  it('rejects conflicting same-run completion, duplicate archive identities, unknown fields and invented history', () => {
    const first = value(snapshotFromEngine(servedRun('r'))); const archive = value(retainRun(createArchive(), first));
    let other = at(resume(start(first.config, 'r')), 9); other = action(other, { kind: 'end', reason: 'manual-stop' });
    expect(retainRun(archive, value(snapshotFromEngine(other)))).toMatchObject({ ok: false, issues: [{ code: 'RETENTION_CONFLICT' }] });
    expect(getRun({ schema: 'sof-archive/v1', runs: [first, first] }, 'r').ok).toBe(false);
    expect(retainRun({ ...archive, personal: 'x' }, first).ok).toBe(false);
    expect(retainRun(archive, { ...first, history: null }).ok).toBe(false);
  });
});
