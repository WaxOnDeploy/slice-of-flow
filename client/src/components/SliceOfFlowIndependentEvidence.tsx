import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, XAxis, YAxis } from 'recharts';
import { buildCfd, type CfdBand, type CfdPoint } from '@/lib/flow/cfd';
import { getRun } from '@/lib/sofEngine/runSnapshots';
import type { RunArchive } from '@/lib/sofEngine/types';
import { compareTwoRuns, type ComparisonMetric, type Reading } from '@/lib/sof-comparison/compare';
import '@/lib/sliceOfFlowIndependentEvidence.css';

const BANDS: readonly { key: CfdBand; name: string; color: string }[] = [
  { key: 'served', name: 'Served', color: '#2F7041' },
  { key: 'discarded', name: 'Discarded / burnt', color: '#9C3529' },
  { key: 'boxDeliver', name: 'Pizza Box', color: '#6B493B' },
  { key: 'oven', name: 'Oven', color: '#C48327' },
  { key: 'prep', name: 'Prep', color: '#5178A0' },
  { key: 'orderQueue', name: 'Orders', color: '#8663A2' },
  { key: 'waiting', name: 'Not admitted', color: '#C8BCA5' },
];
const METRICS: Record<ComparisonMetric, string> = {
  served: 'Served tickets', burnt: 'Burnt tickets', otherDiscard: 'Other discarded tickets',
  angry: 'Angry non-burnt admitted tickets', stillInProgress: 'Still in progress',
  deliveryRate: 'Delivery rate', allExitRate: 'All-exit rate', averageWip: 'Time-weighted average WIP',
  measuredServed: 'Measured Orders-to-served mean', illustration: 'Short-run Orders-to-exit illustration',
};
const format = (value: number | null, digits = 3) => value === null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: digits });
const reasons = { 'missing-run': 'attempt missing', 'invalid-run': 'attempt not valid', 'zero-duration': 'no positive observation time', 'no-served-samples': 'no served samples', 'zero-exits': 'no ticket exits', 'incompatible-definition': 'different measurement definitions', overflow: 'unsupported numeric range' };
const reading = (value: Reading) => value.value === null ? `Unavailable (${value.unavailable ? reasons[value.unavailable] : 'no usable observation'})` : `${format(value.value)} ${value.unit}`;
const events: Record<string, string> = { runStarted: 'Run started', arrival: 'Order available', admission: 'Entered Orders', movement: 'Station move', ready: 'Work ready', service: 'Served', discard: 'Ticket exit', anger: 'Customer threshold reached', blockStart: 'Hold started', blockEnd: 'Hold ended', commandAccepted: 'Accepted action', runEnded: 'Run ended' };

/** Read-only consumers of actual frozen lab archives. No old-game history, automatic baseline,
 * invented samples, match reclassification, live-score mutation or export inclusion. */
export default function SliceOfFlowIndependentEvidence({ archive }: { archive: RunArchive }) {
  const [flowId, setFlowId] = useState('');
  const [prefix, setPrefix] = useState(0);
  const [baselineId, setBaselineId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const selected = useMemo(() => flowId ? getRun(archive, flowId) : null, [archive, flowId]);
  const flow = useMemo(() => selected?.ok && selected.value ? buildCfd(selected.value) : null, [selected]);
  const point = flow?.ok ? flow.value.points[Math.min(prefix, flow.value.points.length - 1)] : null;
  const comparison = useMemo(() => baselineId && subjectId && baselineId !== subjectId ? compareTwoRuns(archive, {
    pairId: 'lab-preview-contextual-pair', baselineRunId: baselineId, subjectRunId: subjectId,
    requestedBasis: 'contextual', change: null,
  }) : null, [archive, baselineId, subjectId]);
  const options = archive.runs.map((run, index) => <option key={run.runId} value={run.runId}>Recorded run {index + 1} · {run.runId} · {format(run.observation.durationMs / 1000)} sim seconds · {run.endReason}</option>);

  return <section className="sof-lab-evidence" aria-labelledby="lab-evidence-title" data-testid="lab-evidence">
    <h2 id="lab-evidence-title">Recorded lab evidence</h2>
    <p>Only completed independent lab simulations appear here. These are not the earlier Round 1 / Round 2 histories. No results are uploaded or retained after a page reload.</p>
    {archive.runs.length > 0 && <p>On a narrow screen, scroll the numeric tables sideways to see every column.</p>}
    {archive.runs.length === 0 && <p>No recorded attempts yet. Complete a lab run to inspect its flow.</p>}
    <details>
      <summary>Inspect recorded cumulative flow</summary>
      <label className="sof-lab-evidence-field">Recorded attempt
        <select value={flowId} onChange={event => { setFlowId(event.target.value); setPrefix(0); }}>
          <option value="">Choose a completed attempt</option>{options}
        </select>
      </label>
      {selected && !selected.ok && <p role="status">This recorded attempt is unavailable. Choose another completed attempt.</p>}
      {flow && !flow.ok && <p role="status">Complete, reconciled flow history is unavailable for this attempt. No chart has been inferred.</p>}
      {flow?.ok && <>
        <p>Observation: {format(flow.value.observation.durationMs / 1000)} simulated seconds. Source: engine-boundary events, independently reconciled. Population: available tickets; “Not admitted” is outside active WIP. Blocked tickets stay in their active station.</p>
        <p>This is a step chart of every recorded event prefix, including equal-time transitions. It is not smoothed or reconstructed from final totals.</p>
        {flow.value.observation.durationMs > 0 ? <div className="sof-lab-cfd-chart" role="img" aria-label="Cumulative flow by station in simulated seconds. A complete numeric event table follows." data-testid="lab-cfd-chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={flow.value.points as CfdPoint[]} margin={{ top: 16, right: 20, left: 4, bottom: 32 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#D9CBBB" />
              <XAxis dataKey="atSimSec" type="number" domain={[0, flow.value.observation.durationMs / 1000]} label={{ value: 'Simulated seconds', position: 'insideBottom', offset: -20 }} tick={{ fill: '#493327', fontSize: 14 }} />
              <YAxis allowDecimals={false} domain={[0, Math.max(...flow.value.points.map(row => row.raw.arrived), 1)]} tick={{ fill: '#493327', fontSize: 14 }} label={{ value: 'Tickets', angle: -90, position: 'insideLeft' }} />
              {BANDS.map(band => <Area key={band.key} name={band.name} type="stepAfter" dataKey={(row: CfdPoint) => row.bands[band.key]} stackId="tickets" stroke={band.color} fill={band.color} fillOpacity={0.78} isAnimationActive={false} />)}
            </AreaChart>
          </ResponsiveContainer>
        </div> : <p>No positive observation window: the table shows exact time-zero history without inventing an elapsed-time chart.</p>}
        <ul className="sof-lab-cfd-legend" aria-label="Flow bands">{BANDS.map(band => <li key={band.key}><span aria-hidden="true" style={{ background: band.color }} />{band.name}</li>)}</ul>
        <label className="sof-lab-evidence-field">Recorded event prefix
          <input type="range" min={0} max={flow.value.points.length - 1} step={1} value={Math.min(prefix, flow.value.points.length - 1)} onChange={event => setPrefix(Number(event.target.value))} aria-valuetext={point ? `${(point.atMs / 1000).toFixed(3)} simulated seconds, sequence ${point.throughSeq ?? 'initial zero'}` : undefined} />
        </label>
        {point && <p data-testid="lab-cfd-prefix">At {(point.atMs / 1000).toFixed(3)} sim seconds · sequence {point.throughSeq ?? 'initial zero'} · active {point.active} · served {point.raw.served} · discarded {point.raw.discarded}. Blocked active: Orders {point.blockedByStation.orderQueue}, Prep {point.blockedByStation.prep}, Oven {point.blockedByStation.oven}, Pizza Box {point.blockedByStation.boxDeliver}.</p>}
        <div className="sof-lab-evidence-scroll" tabIndex={0} role="region" aria-label="Complete recorded flow event table">
          <table><caption>Every retained event prefix — exact millisecond time, not display-rounded history</caption><thead><tr><th scope="col">Sim seconds</th><th scope="col">Sequence</th><th scope="col">Event</th>{BANDS.map(band => <th scope="col" key={band.key}>{band.name}</th>)}<th scope="col">Active</th></tr></thead>
            <tbody>{flow.value.points.map((row, index) => <tr key={index}><td>{(row.atMs / 1000).toFixed(3)}</td><td>{row.throughSeq ?? 'initial'}</td><td>{row.eventKind ? events[row.eventKind] ?? row.eventKind : 'Before first event'}</td>{BANDS.map(band => <td key={band.key}>{row.bands[band.key]}</td>)}<td>{row.active}</td></tr>)}</tbody>
          </table>
        </div>
      </>}
    </details>
    <details>
      <summary>Compare two selected lab attempts</summary>
      <p>Choose both attempts explicitly. This preview is a contextual comparison, not a matched policy experiment. Different decisions, pauses or observation windows can affect the results; no winner or causal benefit is implied.</p>
      <div className="sof-lab-pair-selectors">
        <label className="sof-lab-evidence-field">Baseline attempt<select value={baselineId} onChange={event => setBaselineId(event.target.value)}><option value="">Choose baseline</option>{options}</select></label>
        <label className="sof-lab-evidence-field">Comparison attempt<select value={subjectId} onChange={event => setSubjectId(event.target.value)}><option value="">Choose comparison</option>{options}</select></label>
      </div>
      {baselineId && baselineId === subjectId && <p role="status">Choose two different recorded attempts. The same attempt is not a comparison.</p>}
      {!comparison && baselineId !== subjectId && <p>Both recorded attempts are required before any deltas are shown.</p>}
      {comparison && <>
        <p data-testid="lab-comparison-basis">Basis: {comparison.assessment.kind}. Descriptive results only. {comparison.assessment.kind === 'missing' || comparison.assessment.kind === 'unmatched' ? 'This is not a matched comparison.' : ''}</p>
        {comparison.baseline && comparison.subject && <p>Baseline observation: {format(comparison.baseline.observation.durationMs / 1000)} sim seconds; comparison: {format(comparison.subject.observation.durationMs / 1000)} sim seconds. Served sample counts: {comparison.baseline.measuredServedSampleCount} and {comparison.subject.measuredServedSampleCount}.</p>}
        <div className="sof-lab-evidence-scroll" tabIndex={0} role="region" aria-label="Descriptive selected-attempt results">
          <table><caption>Comparison minus baseline; unavailable values are not zero</caption><thead><tr><th scope="col">Metric</th><th scope="col">Baseline</th><th scope="col">Comparison</th><th scope="col">Delta</th><th scope="col">Definition / population</th></tr></thead>
            <tbody>{comparison.rows.map(row => <tr key={row.metric}><th scope="row">{METRICS[row.metric]}</th><td>{reading(row.baseline)}</td><td>{reading(row.subject)}</td><td>{row.delta === null ? 'Unavailable' : `${row.delta > 0 ? '+' : ''}${format(row.delta)} ${row.baseline.unit}`}</td><td>{row.baseline.definition}<br />{row.baseline.population}{row.metric === 'measuredServed' && <><br />Sample n: {row.baseline.sampleCount ?? 'unknown'} / {row.subject.sampleCount ?? 'unknown'}</>}</td></tr>)}</tbody>
          </table>
        </div>
        <p>{comparison.exitRateDistinction}</p><p>{comparison.illustrationCaveat}</p>
      </>}
    </details>
  </section>;
}
