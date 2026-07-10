// src/scene/TargetMarker.jsx
import { useRobotStore } from '../utils/useRobotStore.js';

export default function TargetMarker() {
  const { targetPosition } = useRobotStore();
  return (
    <div className="target-marker-readout">
      Target&nbsp;
      ({targetPosition.x.toFixed(3)},&nbsp;
      {targetPosition.y.toFixed(3)},&nbsp;
      {targetPosition.z.toFixed(3)})
    </div>
  );
}
