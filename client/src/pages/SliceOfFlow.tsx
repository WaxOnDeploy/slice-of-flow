import { useEffect, useRef } from 'react';
import { useSliceOfFlowStore } from '@/lib/sliceOfFlowStore';
import SliceOfFlowLanding from './SliceOfFlowLanding';
import SliceOfFlowBoard from './SliceOfFlowBoard';
import SliceOfFlowTransition from './SliceOfFlowTransition';
import SliceOfFlowDebrief from './SliceOfFlowDebrief';

export default function SliceOfFlow() {
  const phase = useSliceOfFlowStore((s) => s.phase);
  const isRunning = useSliceOfFlowStore((s) => s.isRunning);
  const tick = useSliceOfFlowStore((s) => s.tick);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Game tick — runs every second while game is active
  useEffect(() => {
    if (isRunning) {
      intervalRef.current = setInterval(() => {
        tick();
      }, 1000);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, tick]);

  switch (phase) {
    case 'landing':
      return <SliceOfFlowLanding />;
    case 'round1':
    case 'round2':
      return <SliceOfFlowBoard />;
    case 'transition':
      return <SliceOfFlowTransition />;
    case 'debrief':
      return <SliceOfFlowDebrief />;
    default:
      return <SliceOfFlowLanding />;
  }
}
