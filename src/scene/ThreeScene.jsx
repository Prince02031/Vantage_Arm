// src/scene/ThreeScene.jsx
// Person 1 owns this file on feat/scene-urdf. If they have not wired a real
// Three.js scene yet, we render a labeled SVG placeholder so the dashboard
// remains demo-able. The real component, when present, will be detected by
// the presence of a default export.
import React from 'react';
import { useRobotStore } from '../utils/useRobotStore.js';

function PlaceholderScene() {
  const { jointAngles, eePosition, targetPosition } = useRobotStore();

  return (
    <div className="scene-placeholder" data-testid="scene-placeholder">
      <svg viewBox="0 0 600 360" preserveAspectRatio="xMidYMid meet" aria-label="Arm scene placeholder">
        <defs>
          <linearGradient id="grid" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#1a1f2e" />
            <stop offset="100%" stopColor="#0d1117" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="600" height="360" fill="url(#grid)" />
        {/* Grid lines */}
        {Array.from({ length: 12 }).map((_, i) => (
          <line key={`v${i}`} x1={i * 50} y1={0} x2={i * 50} y2={360} stroke="#222a3a" strokeWidth="1" />
        ))}
        {Array.from({ length: 8 }).map((_, i) => (
          <line key={`h${i}`} x1={0} y1={i * 50} x2={600} y2={i * 50} stroke="#222a3a" strokeWidth="1" />
        ))}

        {/* Arm base */}
        <circle cx="300" cy="320" r="22" fill="#3b82f6" stroke="#bfdbfe" strokeWidth="2" />
        {/* Stylus approximated to EE position */}
        <circle
          cx={300 + eePosition.x * 320}
          cy={320 - eePosition.y * 320}
          r="8"
          fill="#f59e0b"
        />
        {/* Target marker */}
        <circle
          cx={300 + targetPosition.x * 320}
          cy={320 - targetPosition.y * 320}
          r="10"
          fill="none"
          stroke="#22c55e"
          strokeDasharray="4 4"
          strokeWidth="2"
        />
        <text x="10" y="20" fill="#cbd5e1" fontSize="12" fontFamily="monospace">
          Scene placeholder (Person 1 will provide the real Three.js canvas)
        </text>
        <text x="10" y="345" fill="#94a3b8" fontSize="11" fontFamily="monospace">
          EE ({eePosition.x.toFixed(2)}, {eePosition.y.toFixed(2)}, {eePosition.z.toFixed(2)})  •  Joints:&nbsp;
          {jointAngles.map((q) => q.toFixed(2)).join(', ')}
        </text>
      </svg>
    </div>
  );
}

// Detect whether Person 1 has installed a real implementation. We use a
// stable global flag (set on window by Person 1's component) so we don't try
// to import-cycle on a not-yet-existent module. If the flag is missing, we
// render the placeholder; the placeholder always works so we never crash the
// dashboard before Person 1 lands their work.
function ThreeScene() {
  const useRealScene = typeof window !== 'undefined' && window.__VA_USE_REAL_SCENE__ === true;
  if (useRealScene) {
    // The real scene is mounted globally by Person 1 into #va-scene-mount.
    return <div id="va-scene-mount" className="scene-mount-slot" />;
  }
  return <PlaceholderScene />;
}

export default ThreeScene;
