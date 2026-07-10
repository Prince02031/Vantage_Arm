// src/scene/ArmModel.jsx
// Person 1 will render the actual URDF here. This placeholder renders the
// current joint angles as a textual readout so the dashboard works in the
// interim.
import { useRobotStore } from '../utils/useRobotStore.js';

export default function ArmModel() {
  const { jointAngles } = useRobotStore();
  return (
    <div className="arm-model-readout">
      {jointAngles.map((q, i) => (
        <div key={i} className="arm-model-joint">
          <span>J{i + 1}</span>
          <strong>{q.toFixed(2)} rad</strong>
        </div>
      ))}
    </div>
  );
}
