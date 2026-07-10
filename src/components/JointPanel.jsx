// src/components/JointPanel.jsx
// Read-only display of the current joint angles and end-effector pose.
// Phase A store only ships jointAngles[0..5] = 0. Phase C will populate the
// real values. The component renders 6 placeholders either way.
import { useRobotStore } from '../utils/useRobotStore.js';
import { formatAngle, formatCoord } from '../utils/formatters.js';

const JOINT_LABELS = ['Base', 'Shoulder', 'Elbow', 'Wrist Roll', 'Wrist Pitch', 'Wrist Yaw'];

export default function JointPanel() {
  const { jointAngles, eePosition } = useRobotStore();
  const angles = Array.from({ length: 6 }, (_, i) => jointAngles?.[i] ?? 0);

  return (
    <section className="joint-panel" aria-label="Joint state">
      <header className="joint-panel-header">
        <h3>Joint State</h3>
      </header>
      <div className="joint-grid">
        {angles.map((q, i) => (
          <div key={i} className="joint-card">
            <div className="joint-label">J{i + 1} · {JOINT_LABELS[i]}</div>
            <div className="joint-value">{formatAngle(q)}</div>
          </div>
        ))}
      </div>
      <div className="ee-readout">
        <h4>End-Effector Pose</h4>
        <div className="ee-coords">
          <span>{formatCoord('X', eePosition?.x)}</span>
          <span>{formatCoord('Y', eePosition?.y)}</span>
          <span>{formatCoord('Z', eePosition?.z)}</span>
        </div>
      </div>
    </section>
  );
}
