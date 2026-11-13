import { measureVipResults } from '@/lib/sofEngine/vip';
import type { FinalRunSnapshot } from '@/lib/sofEngine/types';

const seconds = (ms: number | null) => ms === null ? 'N/A (no served samples)' : `${(ms / 1000).toFixed(1)}s`;
export default function SliceOfFlowVipComparisonTable({ baseline, subject }: { baseline: FinalRunSnapshot; subject: FinalRunSnapshot }) {
  const a = measureVipResults(baseline), b = measureVipResults(subject);
  if (!a.ok || !b.ok) return <p>Comparison values unavailable: a selected result did not pass validation.</p>;
  const rows = [
    ['Observed kitchen time', seconds(baseline.observation.durationMs), seconds(subject.observation.durationMs)],
    ['Total served', baseline.metrics.served, subject.metrics.served],
    ['Total burnt', baseline.metrics.burnt, subject.metrics.burnt],
    ['VIPs served on time', a.value.vipOnTime, b.value.vipOnTime],
    ['VIP arrival-to-served mean', seconds(a.value.vipMeanArrivalToServedMs), seconds(b.value.vipMeanArrivalToServedMs)],
    ['VIP served sample size', a.value.vipServedN, b.value.vipServedN],
    ['Normal arrival-to-served mean', seconds(a.value.normalMeanArrivalToServedMs), seconds(b.value.normalMeanArrivalToServedMs)],
    ['Normal Orders-to-served mean', seconds(a.value.normalMeanOrdersToServedMs), seconds(b.value.normalMeanOrdersToServedMs)],
    ['Normal served sample size', a.value.normalServedN, b.value.normalServedN],
    ['Normal tickets waiting during VIP activity', a.value.normalWaitedDuringVipCount, b.value.normalWaitedDuringVipCount],
    ['Missed VIP deadline penalties', a.value.deadlinePenaltyCount, b.value.deadlinePenaltyCount],
    ['Final score', a.value.score, b.value.score],
  ];
  return <div>
    <p>These are the two runs you selected, not Round 2 or an automatically chosen best result. All times are simulated. Waiting overlap is observed association, not proof of delay caused by VIPs.</p>
    <p id="vip-table-scroll-hint">On a narrow screen, scroll the table sideways.</p>
    <div className="sof-vip-table-scroll" role="region" aria-label="Selected FIFO and expedite results" aria-describedby="vip-table-scroll-hint" tabIndex={0}>
      <table data-testid="vip-comparison-table">
        <caption>Selected FIFO baseline versus VIP expedite</caption>
        <thead><tr><th scope="col">Measure</th><th scope="col">FIFO baseline</th><th scope="col">VIP expedite</th></tr></thead>
        <tbody>{rows.map(([label, before, after]) => <tr key={String(label)}><th scope="row">{label}</th><td>{before}</td><td>{after}</td></tr>)}</tbody>
      </table>
    </div>
  </div>;
}
