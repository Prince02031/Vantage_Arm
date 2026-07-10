// src/components/KeyPressPanel.jsx
// Phase C: Direct key-press buttons for demo and debugging.
// Each button dispatches executeCommand({ type: "pressKey", key, source: "dashboard" })
// through the shared motion pipeline. No direct robot mutation.
import { useState } from 'react';
import { executeCommand } from '../core/motionPipeline.js';

const KEY_COLORS = {
  '1': '#e05a3a',
  '2': '#e0913a',
  '3': '#e0c93a',
  '4': '#57c26a',
  '5': '#3a9fe0',
  '6': '#a65ae0'
};

const KEY_LABELS = {
  '1': 'Key 1',
  '2': 'Key 2',
  '3': 'Key 3',
  '4': 'Key 4',
  '5': 'Key 5',
  '6': 'Key 6'
};

export default function KeyPressPanel() {
  const [busy, setBusy] = useState(null); // which key is executing
  const [lastResult, setLastResult] = useState(null);

  const triggerViolation = async (name, type, payload) => {
    if (busy !== null) return;
    setBusy(name);
    setLastResult(null);
    try {
      const res = await executeCommand({
        type,
        payload,
        source: 'dashboard'
      });
      setLastResult({
        key: name,
        ok: res?.ok ?? false,
        message: res?.message ?? 'Command sent.'
      });
    } catch (err) {
      setLastResult({
        key: name,
        ok: false,
        message: err?.message || `${name} failed.`
      });
    } finally {
      setBusy(null);
    }
  };

  const pressKey = async (key) => {
    if (busy !== null) return;
    setBusy(key);
    setLastResult(null);
    try {
      const res = await executeCommand({
        type: 'pressKey',
        key: String(key),
        source: 'dashboard'
      });
      setLastResult({
        key,
        ok: res?.ok ?? false,
        message: res?.message ?? 'No response from pipeline.'
      });
    } catch (err) {
      setLastResult({ key, ok: false, message: err?.message || 'pressKey failed.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <section className="keypress-panel" aria-label="Press key controls">
      <header className="keypress-panel-header">
        <h3>Press Key</h3>
        <span className="panel-subtitle">Approach → Touch → Retreat via pipeline</span>
      </header>

      <div className="keypress-grid">
        {['1', '2', '3', '4', '5', '6'].map((k) => (
          <button
            key={k}
            id={`press-key-btn-${k}`}
            type="button"
            className={`btn btn-key-press ${busy === k ? 'btn-key-press--busy' : ''}`}
            style={{ '--key-color': KEY_COLORS[k] }}
            onClick={() => pressKey(k)}
            disabled={busy !== null}
            aria-label={`Press ${KEY_LABELS[k]}`}
            title={`Execute pressKey("${k}") through motion pipeline`}
          >
            {busy === k ? '…' : k}
            <span className="btn-key-sublabel">{KEY_LABELS[k]}</span>
          </button>
        ))}
      </div>

      <div className="keypress-violations">
        <h4 className="violation-title">Test Safety Violations</h4>
        <div className="violation-grid">
          <button
            type="button"
            className="btn btn-violation"
            onClick={() => triggerViolation('Out of Bounds', 'moveTo', { target: { x: 1.5, y: 0.2, z: 0.5 } })}
            disabled={busy !== null}
            title="Attempts to move to X=1.5m (Limit: [-1.2m, 1.2m])"
          >
            Out of X Bounds
          </button>
          <button
            type="button"
            className="btn btn-violation"
            onClick={() => triggerViolation('Floor Collision', 'moveTo', { target: { x: 0.1, y: 0.2, z: -0.15 } })}
            disabled={busy !== null}
            title="Attempts to move to Z=-0.15m (Limit: >= 0.0m)"
          >
            Floor Collision
          </button>
          <button
            type="button"
            className="btn btn-violation"
            onClick={() => triggerViolation('Excessive Jog', 'jog', { axis: 'z', delta: 0.15 })}
            disabled={busy !== null}
            title="Attempts to jog Z by +15cm (Limit: 10cm)"
          >
            Excessive Jog Step
          </button>
          <button
            type="button"
            className="btn btn-violation"
            onClick={() => triggerViolation('Invalid Key', 'pressKey', { key: '9' })}
            disabled={busy !== null}
            title="Attempts to press key 9 (Limit: keys 1-6)"
          >
            Invalid Key Target
          </button>
        </div>
      </div>

      {lastResult && (
        <div className={`keypress-result ${lastResult.ok ? 'keypress-result--ok' : 'keypress-result--fail'}`}>
          <strong>{lastResult.key}:</strong>{' '}
          <span>{lastResult.ok ? '✓' : '✗'} {lastResult.message}</span>
        </div>
      )}

      <p className="keypress-hint">
        Executes the full <code>approach → touch → retreat</code> sequence via IK.
        Success if final EE distance ≤ 5mm. Flash on Key 5 is the Phase C target.
      </p>
    </section>
  );
}
