// JointPanel.jsx
// Compact read-only joint-state panel (for embedding inside the scene overlay).
// The parent passes `joints` — a map of joint name → angle in radians.
import React from 'react';

const JOINT_META = [
    { key: 'joint_1', short: 'J1', label: 'Base Yaw' },
    { key: 'joint_2', short: 'J2', label: 'Shoulder' },
    { key: 'joint_3', short: 'J3', label: 'Elbow' },
    { key: 'joint_4', short: 'J4', label: 'Forearm Roll' },
    { key: 'joint_5', short: 'J5', label: 'Wrist Pitch' },
    { key: 'joint_6', short: 'J6', label: 'Tool Roll' },
    { key: 'stylus_pitch', short: 'J7', label: 'Stylus Pitch' },
];

const RAD2DEG = 180 / Math.PI;

function bar(v, lo = -Math.PI, hi = Math.PI) {
    if (v == null) return 0;
    const pct = ((v - lo) / (hi - lo)) * 100;
    return Math.max(0, Math.min(100, pct));
}

export default function JointPanel({ joints = {}, limits = {} }) {
    return (
        <div className="joint-panel">
            {JOINT_META.map(({ key, short, label }) => {
                const rad = joints[key] ?? 0;
                const deg = (rad * RAD2DEG).toFixed(1);
                const lim = limits[key];
                const lo = lim?.lower ?? -Math.PI;
                const hi = lim?.upper ?? Math.PI;
                const pct = bar(rad, lo, hi);
                return (
                    <div key={key} className="jp-row">
                        <span className="jp-short">{short}</span>
                        <span className="jp-label">{label}</span>
                        <div className="jp-bar-wrap">
                            <div className="jp-bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="jp-val">{deg}°</span>
                    </div>
                );
            })}
        </div>
    );
}
