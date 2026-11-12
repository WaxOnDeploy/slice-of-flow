import { useId } from 'react';
import { ACTIVE_ORDER_TYPES, getOrderTypePolicyCopy } from '@/lib/sliceOfFlowOrderTypes';

export interface SliceOfFlowOrderGuideProps {
  title?: string;
  headingLevel?: 2 | 3;
  /** Paper for pre-play/tutorial; chalkboard for Today's Specials. */
  variant?: 'paper' | 'chalkboard';
  className?: string;
  testId?: string;
  compact?: boolean;
}

/** Informational only: no store access, timers, or mandatory acknowledgement. */
export function SliceOfFlowOrderGuide({
  title = "Meet today's orders",
  headingLevel = 2,
  variant = 'paper',
  className = '',
  testId = 'order-guide',
  compact = false,
}: SliceOfFlowOrderGuideProps) {
  const headingId = useId();
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  const chalkboard = variant === 'chalkboard';
  const customBuild = ACTIVE_ORDER_TYPES.find(type => type.pizzaType === 'Custom Build');

  return (
    <section
      aria-labelledby={headingId}
      data-testid={testId}
      className={`min-w-0 rounded-xl p-4 sm:p-5 ${className}`}
      style={{
        background: chalkboard ? '#2A1508' : '#FFF8E7',
        border: `1px solid ${chalkboard ? '#D4A843' : '#DEC59B'}`,
        color: chalkboard ? '#FFF8E7' : '#534334',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 16,
        lineHeight: 1.5,
        overflowWrap: 'anywhere',
      }}
    >
      <Heading
        id={headingId}
        className="text-xl font-bold mb-2"
        style={{ color: chalkboard ? '#FFD77A' : '#7B3F1A' }}
      >
        {title}
      </Heading>
      {!compact && <p className="mb-3">
        Here&apos;s what&apos;s on the menu. The size on each ticket sets its Prep and Oven time.
      </p>}
      <ul className="space-y-2" aria-label="Active pizza types and size rules">
        {ACTIVE_ORDER_TYPES.map(type => (
          <li key={`${type.pizzaType}-${type.size}-${type.prepTime}-${type.ovenTime}`}>
            <strong className={compact ? 'mr-2' : 'block'}>{type.pizzaType}</strong>
            <span>{`${type.size} · Prep ${type.prepTime}s · Oven ${type.ovenTime}s`}</span>
          </li>
        ))}
      </ul>
      {customBuild && (
        <p className="mt-3" data-testid="custom-build-policy">
          {getOrderTypePolicyCopy(customBuild)}
        </p>
      )}
      <p className="mt-3">
        All times are simulated kitchen seconds. Clock speed changes how quickly time passes, not the pizza rules.
      </p>
    </section>
  );
}

export default SliceOfFlowOrderGuide;
