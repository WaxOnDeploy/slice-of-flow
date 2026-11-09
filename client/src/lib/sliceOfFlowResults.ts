import type { RoundMetrics } from "./sliceOfFlowConstants";

/** A completed-order sample and a finite, positive elapsed time are required. */
export function hasLeadTime(metrics: RoundMetrics | null): boolean {
  return (
    metrics !== null &&
    Number.isFinite(metrics.served) &&
    metrics.served > 0 &&
    Number.isFinite(metrics.avgLeadTime) &&
    metrics.avgLeadTime > 0
  );
}

/** Deltas are Round 2 minus Round 1; percentage values are not display-rounded. */
export function getResultsComparison(
  r1: RoundMetrics | null,
  r2: RoundMetrics | null
): {
  scorePercent: number | null;
  scoreDelta: number | null;
  leadTimeDelta: number | null;
} {
  const scoreDelta = finiteDelta(r1?.score, r2?.score);
  const leadTimeDelta =
    hasLeadTime(r1) && hasLeadTime(r2)
      ? finiteDelta(r1!.avgLeadTime, r2!.avgLeadTime)
      : null;

  // A score-only bonus, skipped round, or absent completed sample is not a
  // complete comparison baseline. Raw score differences remain independent.
  const percent =
    r1 &&
    r2 &&
    hasLeadTime(r1) &&
    hasLeadTime(r2) &&
    Number.isFinite(r1.score) &&
    r1.score > 0 &&
    Number.isFinite(r2.score) &&
    scoreDelta !== null
      ? (scoreDelta / r1.score) * 100
      : null;

  return {
    scorePercent: percent !== null && Number.isFinite(percent) ? percent : null,
    scoreDelta,
    leadTimeDelta,
  };
}

function finiteDelta(
  before: number | undefined,
  after: number | undefined
): number | null {
  if (
    before === undefined ||
    after === undefined ||
    !Number.isFinite(before) ||
    !Number.isFinite(after)
  )
    return null;
  const delta = after - before;
  return Number.isFinite(delta) ? delta : null;
}

function isCount(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value >= 0;
}

function lowerCount(
  before: number | undefined,
  after: number | undefined
): boolean {
  return isCount(before) && isCount(after) && after < before;
}

function higherCount(
  before: number | undefined,
  after: number | undefined
): boolean {
  return isCount(before) && isCount(after) && after > before;
}

function countText(value: number | undefined): string {
  return isCount(value) ? String(value) : "n/a";
}

function scoreText(value: number | undefined): string {
  return value !== undefined && Number.isFinite(value) ? String(value) : "n/a";
}

function formatTime(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);
  return `${minutes}:${String(remainder).padStart(2, "0")}`;
}

function leadTimeText(metrics: RoundMetrics | null): string {
  return hasLeadTime(metrics) ? formatTime(metrics!.avgLeadTime) : "n/a";
}

/** Four observations or reflection prompts, never claims about cause or stress. */
export function getDebriefInsights(
  r1: RoundMetrics | null,
  r2: RoundMetrics | null
): { icon: string; title: string; desc: string; metric: string }[] {
  const fewerBurnt = lowerCount(r1?.burnt, r2?.burnt);
  const moreServed = higherCount(r1?.served, r2?.served);
  const fewerAngry = lowerCount(r1?.angry, r2?.angry);
  const leadDelta = getResultsComparison(r1, r2).leadTimeDelta;
  const lowerLeadTime = leadDelta !== null && leadDelta < 0;
  const servedMetric = `Served: ${countText(r1?.served)} → ${countText(r2?.served)}`;
  const burntMetric = `Burnt: ${countText(r1?.burnt)} → ${countText(r2?.burnt)}`;
  const angryMetric = `Angry: ${countText(r1?.angry)} → ${countText(r2?.angry)}`;

  return [
    {
      icon: "🚦",
      title: fewerBurnt ? "Fewer Burnt Pizzas" : "Reflect on Burnt Pizzas",
      desc: fewerBurnt
        ? "Round 2 recorded fewer burnt pizzas than Round 1. What did you notice while playing?"
        : "Compare burnt counts when both rounds are available. What would you try next time?",
      metric: burntMetric,
    },
    {
      icon: "🎯",
      title:
        moreServed && fewerAngry
          ? "More Served, Fewer Angry Customers"
          : "Reflect on Service Outcomes",
      desc:
        moreServed && fewerAngry
          ? "Round 2 recorded more pizzas served and fewer angry customers than Round 1."
          : "Look at served and angry counts together. What tradeoffs or patterns do you notice?",
      metric: `${servedMetric}; ${angryMetric}`,
    },
    {
      icon: "🔥",
      title: lowerLeadTime
        ? "Lower Completed Lead Time"
        : "Reflect on Completed Lead Time",
      desc: lowerLeadTime
        ? "Average lead time for completed orders was lower in Round 2. Unfinished orders are not included."
        : "Compare average lead time only when both rounds have completed orders with usable elapsed time. Unfinished orders are not included.",
      metric: `Completed lead time: ${leadTimeText(r1)} → ${leadTimeText(r2)}`,
    },
    {
      icon: "📊",
      title:
        moreServed && fewerBurnt
          ? "More Served, Fewer Burnt Pizzas"
          : "Reflect on Served and Burnt Counts",
      desc:
        moreServed && fewerBurnt
          ? "Round 2 recorded more pizzas served and fewer burnt pizzas than Round 1."
          : "Consider served and burnt counts together. What would you experiment with in another round?",
      metric: `${servedMetric}; ${burntMetric}`,
    },
  ];
}

/** Missing records stay n/a; observed zero counts and negative scores stay visible. */
export function generateShareText(
  r1: RoundMetrics | null,
  r2: RoundMetrics | null,
  difficultyLabel: string
): string {
  const { scorePercent } = getResultsComparison(r1, r2);
  const percentText =
    scorePercent === null
      ? "n/a"
      : `${scorePercent > 0 ? "+" : ""}${Number(scorePercent.toFixed(1))}%`;
  const lines = [
    `Slice of Flow — My Results (${difficultyLabel} Mode)`,
    "",
    "Round 1 (Push) → Round 2 (Pull + WIP Limits):",
    "",
    `  Served:     ${countText(r1?.served)} → ${countText(r2?.served)}`,
    `  Burnt:      ${countText(r1?.burnt)} → ${countText(r2?.burnt)}`,
    `  Angry:      ${countText(r1?.angry)} → ${countText(r2?.angry)}`,
    `  Lead Time:  ${leadTimeText(r1)} → ${leadTimeText(r2)}`,
    `  Score:      ${scoreText(r1?.score)} → ${scoreText(r2?.score)}`,
    "",
    `Score change: ${percentText}`,
  ];

  [r1, r2].forEach((metrics, index) => {
    const remaining = metrics?.timeRemaining;
    if (
      remaining !== undefined &&
      Number.isFinite(remaining) &&
      remaining > 0
    ) {
      lines.push(
        `Round ${index + 1} finished with ${formatTime(remaining)} to spare!`
      );
    }
  });

  lines.push(
    "",
    "Compare the recorded outcomes and reflect on what you would try next.",
    "",
    "Play it yourself → https://slice-of-flow.com",
    "#SliceOfFlow #Kanban #Agile #FlowMetrics"
  );
  return lines.join("\n");
}
