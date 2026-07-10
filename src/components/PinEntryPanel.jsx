// src/components/PinEntryPanel.jsx
// Phase D: Full autonomous PIN entry with live progress display.
// Reads pinProgress from the robot store to show per-key results in real-time.
import { useState, useEffect } from 'react';
import { executeCommand } from '../core/motionPipeline.js';
import { CommandTypes } from '../core/commandTypes.js';
import { subscribeRobotState, getRobotState } from '../core/robotStore.js';

const KEYS = ['1', '2', '3', '4', '5', '6'];

export default function PinEntryPanel() {
  const [pin, setPin] = useState('');
  const [running, setRunning] = useState(false);
  const [lastReport, setLastReport] = useState(null);
  const [inputError, setInputError] = useState('');
  const [pinProgress, setPinProgress] = useState(() => getRobotState().pinProgress);

  useEffect(() => {
    const unsub = subscribeRobotState((state) => {
      setPinProgress({ ...state.pinProgress });
    });
    return unsub;
  }, []);

  const append = (digit) => {
    setInputError('');
    setPin((current) => {
      if (current.length >= 6) return current;
      if (!/^[1-6]$/.test(digit)) {
        setInputError(`Digit "${digit}" is not allowed. Use 1-6.`);
        return current;
      }
      return current + digit;
    });
  };

  // Allow typing into the text field but reject any character outside 1-6.
  const onChangeText = (e) => {
    const cleaned = e.target.value.replace(/[^1-6]/g, '').slice(0, 6);
    setPin(cleaned);
    setInputError(cleaned === e.target.value ? '' : 'Only digits 1-6 are allowed.');
  };

  const backspace = () => { setPin((c) => c.slice(0, -1)); setInputError(''); };
  const clear      = () => { setPin(''); setLastReport(null); setInputError(''); };

  const submit = async () => {
    if (pin.length !== 6) {
      setLastReport({ success: false, message: 'PIN must be exactly 6 digits.' });
      return;
    }
    if (!/^[1-6]{6}$/.test(pin)) {
      setLastReport({ success: false, message: 'PIN digits must each be 1-6.' });
      return;
    }
    setRunning(true);
    setLastReport({ success: true, message: `Dispatching PIN [${pin}]…` });
    try {
      const res = await executeCommand({
        type: CommandTypes.RUN_PIN,
        pin,
        source: 'pin-panel'
      });
      // Pipeline returns a normalised result { ok, message }.
      const mappedRes = res && typeof res === 'object' 
        ? { success: res.ok, message: res.message }
        : { success: true, message: 'PIN dispatched.' };
      setLastReport(mappedRes);
    } catch (err) {
      setLastReport({ success: false, message: err?.message || 'PIN execution failed.' });
    } finally {
      setRunning(false);
    }
  };

  const pinValid = /^[1-6]{6}$/.test(pin);

  return (
    <section className="pin-panel" aria-label="Autonomous PIN entry">
      <header className="pin-panel-header">
        <h3>Autonomous PIN</h3>
        <span className="panel-subtitle">6-digit autonomous entry · digits 1-6</span>
      </header>

      <div className="pin-display" aria-live="polite">
        {Array.from({ length: 6 }).map((_, i) => (
          <span key={i} className={`pin-cell ${pin[i] ? 'filled' : ''}`}>
            {pin[i] ? '•' : '_'}
          </span>
        ))}
      </div>

      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={pin}
        onChange={onChangeText}
        placeholder="123456"
        aria-label="6-digit PIN"
        className={`pin-text-input ${inputError ? 'pin-text-input-bad' : ''}`}
      />

      {inputError && <p className="pin-error">{inputError}</p>}

      <div className="pin-keypad">
        {KEYS.map((d) => (
          <button
            key={d}
            type="button"
            className="btn btn-joy"
            onClick={() => append(d)}
            disabled={running || pin.length >= 6}
            aria-label={`Append digit ${d}`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="pin-actions">
        <button type="button" className="btn btn-secondary" onClick={backspace} disabled={running}>Backspace</button>
        <button type="button" className="btn btn-secondary" onClick={clear}      disabled={running}>Clear</button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={submit}
          disabled={running || !pinValid}
          title={!pinValid ? 'Type 6 digits (each between 1 and 6).' : undefined}
        >
          {running ? 'Running…' : 'Execute PIN'}
        </button>
      </div>

      {running && (
        <button
          type="button"
          className="btn btn-danger"
          style={{ marginTop: '0.5rem', width: '100%' }}
          onClick={() => executeCommand({ type: 'stop', source: 'pin-panel' })}
        >
          ⛔ Stop Sequence
        </button>
      )}

      {/* Live per-key progress table */}
      {pinProgress.results && pinProgress.results.length > 0 && (
        <div className="pin-progress" style={{ marginTop: '0.75rem' }}>
          <strong style={{ fontSize: '0.75rem', opacity: 0.8 }}>Progress ({pinProgress.pressed.length}/6 pressed)</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
            {pinProgress.results.map((r, i) => (
              <span
                key={i}
                title={`${r.message} (${r.errorM != null ? (r.errorM * 1000).toFixed(1) + 'mm' : 'n/a'})`}
                style={{
                  padding: '2px 7px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  background: r.ok ? 'rgba(0,200,100,0.2)' : 'rgba(255,80,80,0.2)',
                  border: `1px solid ${r.ok ? '#00c864' : '#ff5050'}`,
                  color: r.ok ? '#00ff88' : '#ff6666'
                }}
              >
                Key {r.key} {r.ok ? '✓' : '✗'}
              </span>
            ))}
          </div>
          {pinProgress.running && pinProgress.currentKey && (
            <p style={{ fontSize: '0.7rem', opacity: 0.7, marginTop: '4px' }}>
              ⟳ Pressing Key {pinProgress.currentKey} (digit {(pinProgress.currentIndex + 1)}/6)…
            </p>
          )}
          {pinProgress.failed && pinProgress.failureReason && (
            <p style={{ fontSize: '0.7rem', color: '#ff6666', marginTop: '4px' }}>
              ✗ {pinProgress.failureReason}
            </p>
          )}
        </div>
      )}

      {lastReport && (
        <div className={`pin-report ${lastReport.success ? 'pin-report-ok' : 'pin-report-bad'}`}>
          <strong>{lastReport.success ? 'OK' : 'Failed'}</strong>
          <span>{lastReport.message}</span>
        </div>
      )}

      <p className="pin-hint">
        Phase D: Autonomous sequential key tapping for a 6-digit PIN via <code>executeCommand</code>.
        Each key press performs approach → touch → verify tolerance → retreat.
      </p>
    </section>
  );
}
