import { useId } from 'react';
import { COLORS, type RoundMetrics } from '@/lib/sliceOfFlowConstants';
import { getScoringCopy, getZeroBurnBonusCopy } from '@/lib/sliceOfFlowScoringCopy';

interface ScoringExplanationProps {
  rounds: { label: string; metrics: RoundMetrics | null }[];
}

export default function SliceOfFlowScoringExplanation({ rounds }: ScoringExplanationProps) {
  const headingId = useId();
  const copy = getScoringCopy();

  return (
    <section
      aria-labelledby={headingId}
      className="mb-10 p-5 rounded-xl"
      style={{
        background: '#FFF8E7',
        border: '1px solid #D4A843',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 16,
        lineHeight: 1.6,
        color: COLORS.text,
      }}
    >
      <h2
        id={headingId}
        className="mb-2"
        style={{ fontFamily: "'Lilita One', cursive", fontSize: 20, color: COLORS.primary }}
      >
        {copy.heading}
      </h2>
      <p style={{ fontSize: 16, fontWeight: 600 }}>{copy.formula}</p>
      <p className="mt-2">{copy.bonusRule}</p>
      <p className="mt-2">{copy.customerRule}</p>
      {rounds.map(({ label, metrics }) => {
        const bonusCopy = getZeroBurnBonusCopy(metrics);
        return bonusCopy ? (
          <p key={label} className="mt-2" style={{ fontWeight: 600 }}>
            {label}: {bonusCopy}
          </p>
        ) : null;
      })}
    </section>
  );
}
