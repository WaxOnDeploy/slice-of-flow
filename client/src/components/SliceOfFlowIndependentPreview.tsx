import { useState } from 'react';
import type { Difficulty, Speed } from '@/lib/sofEngine/types';
import { createArchive } from '@/lib/sofEngine/runSnapshots';
import SliceOfFlowIndependentLab from './SliceOfFlowIndependentLab';
import SliceOfFlowIndependentEvidence from './SliceOfFlowIndependentEvidence';

/** Draft-only composition. Existing debrief/export regions and ordinary game path are untouched. */
export default function SliceOfFlowIndependentPreview({ difficulty, speed, onClose }: { difficulty: Difficulty; speed: Speed; onClose?: () => void }) {
  const [archive, setArchive] = useState(createArchive);
  return <div className="sof-independent-preview" data-testid="independent-lab-preview">
    <SliceOfFlowIndependentLab difficulty={difficulty} speed={speed} onClose={onClose} onArchiveChange={setArchive} />
    <SliceOfFlowIndependentEvidence archive={archive} />
  </div>;
}
