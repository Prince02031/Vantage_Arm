// src/components/TargetInputPanel.jsx
// Phase B numeric Move-To panel. User enters x, y, z (meters) and presses
// "Move To" which dispatches a MOVE_TO command through executeCommand.
import { useState } from 'react';
import { executeCommand } from '../core/motionPipeline.js';
import { CommandTypes } from '../core/commandTypes.js';

const DEFAULTS = { x: 0.55, y: 0, z: 0.10 };

export default function TargetInputPanel() {
  const [target, setTarget] = useState({ ...DEFAULTS });
  const [report, setReport] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const update = (axis) => (e) => {
    const raw = e.target.value;
    // Allow blank for editing UX, parse to number otherwise.
    if (raw === '' || raw === '-') {
      setTarget((t) => ({ ...t, [axis]: raw }));
      return;
    }
    const n = Number(raw);
    if (Number.isFinite(n)) setTarget((t) => ({ ...t, [axis]: n }));
  };

  const resetDefaults = () => {
    setTarget({ ...DEFAULTS });
    setReport(null);
  };

  const submit = async () => {
    const { x, y, z } = target;
    if ([x, y, z].some((v) => v === '' || !Number.isFinite(Number(v)))) {
      setReport({ success: false, message: 'All three axes must be finite numbers.' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await executeCommand({
        type: CommandTypes.MOVE_TO,
        payload: { target: { x: Number(x), y: Number(y), z: Number(z) } },
        source: 'dashboard'
      });
      setReport(res && typeof res === 'object'
        ? res
        : { success: true, message: `Move To (${x}, ${y}, ${z}) dispatched.` });
    } catch (err) {
      setReport({ success: false, message: err?.message || 'Move To failed.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="target-panel" aria-label="Move To target input">
      <header className="target-panel-header">
        <h3>Move To</h3>
        <span className="panel-subtitle">Absolute EE target (meters)</span>
      </header>

      <div className="target-grid">
        <label className="target-axis">
          <span>X</span>
          <input
            type="number"
            step="0.01"
            value={target.x}
            onChange={update('x')}
            aria-label="Target X"
          />
        </label>
        <label className="target-axis">
          <span>Y</span>
          <input
            type="number"
            step="0.01"
            value={target.y}
            onChange={update('y')}
            aria-label="Target Y"
          />
        </label>
        <label className="target-axis">
          <span>Z</span>
          <input
            type="number"
            step="0.01"
            value={target.z}
            onChange={update('z')}
            aria-label="Target Z"
          />
        </label>
      </div>

      <div className="target-actions">
        <button type="button" className="btn btn-primary" onClick={submit} disabled={submitting}>
          {submitting ? 'Sending…' : 'Move To'}
        </button>
        <button type="button" className="btn btn-secondary" onClick={resetDefaults}>
          Reset defaults
        </button>
      </div>

      {report && (
        <div className={`target-report ${report.success ? 'pin-report-ok' : 'pin-report-bad'}`}>
          <strong>{report.success ? 'OK' : 'Failed'}</strong>
          <span>{report.message}</span>
        </div>
      )}

      <p className="target-hint">
        Sends <code>{`{ type: "${CommandTypes.MOVE_TO}", target: {x,y,z} }`}</code> through
        the shared pipeline. Defaults sit just outside the 6-key pad centre.
      </p>
    </section>
  );
}
