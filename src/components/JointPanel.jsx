// src/components/JointPanel.jsx
// Read-only display of the current joint angles and end-effector pose.
// Phase A store only ships jointAngles[0..5] = 0. Phase C will populate the
// real values. The component renders 6 placeholders either way.
import { useRobotStore } from '../utils/useRobotStore.js';
import { formatAngle, formatCoord } from '../utils/formatters.js';

const JOINT_LABELS = {
  joint_1: 'Base',
  joint_2: 'Shoulder',
  joint_3: 'Elbow',
  joint_4: 'Wrist Roll',
  joint_5: 'Wrist Pitch',
  joint_6: 'Wrist Yaw',
  stylus_pitch: 'Stylus Pitch'
};

export default function JointPanel() {
  const { jointAngles, eePosition, movableJoints } = useRobotStore();

  const jointsToShow = (movableJoints && movableJoints.length > 0)
    ? movableJoints
    : Object.keys(JOINT_LABELS).map(name => ({ name }));

  return (
    <section className="joint-panel" aria-label="Joint state">
      <header className="joint-panel-header">
        <h3>Joint State</h3>
      </header>
      <div className="joint-grid">
        {jointsToShow.map((joint, i) => {
          const name = typeof joint === 'string' ? joint : joint.name;
          const q = jointAngles?.[name] ?? jointAngles?.[i] ?? 0;
          const label = JOINT_LABELS[name] || name.replace('_', ' ').toUpperCase();
          return (
            <div key={name} className="joint-card">
              <div className="joint-label">J{i + 1} · {label}</div>
              <div className="joint-value">{formatAngle(q)}</div>
            </div>
          );
        })}
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
