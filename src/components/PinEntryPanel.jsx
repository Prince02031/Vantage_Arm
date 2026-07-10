// src/components/PinEntryPanel.jsx
// Phase B ships the panel shell + a RUN_PIN command dispatch. The full
// pinRunner.js orchestration (hover / touch / verify / retract) is wired in
// by Person 2's pipeline when RUN_PIN is selected. Here we just collect a
// 6-digit PIN made of digits 1-6 and route it through the pipeline.
import { useState } from 'react';
import { executeCommand } from '../core/motionPipeline.js';
import { CommandTypes } from '../core/commandTypes.js';

const KEYS = ['1', '2', '3', '4', '5', '6'];

export default function PinEntryPanel() {
  const [pin, setPin] = useState('');
  const [running, setRunning] = useState(false);
  const [lastReport, setLastReport] = useState(null);
  const [inputError, setInputError] = useState('');

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
    setLastReport({ success: true, message: `Dispatching PIN ${pin}…` });
    try {
      const res = await executeCommand({
        type: CommandTypes.RUN_PIN,
        payload: { pin },
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

      {lastReport && (
        <div className={`pin-report ${lastReport.success ? 'pin-report-ok' : 'pin-report-bad'}`}>
          <strong>{lastReport.success ? 'OK' : 'Failed'}</strong>
          <span>{lastReport.message}</span>
        </div>
      )}

      <p className="pin-hint">
        Full hover/touch/verify/retract orchestration runs through
        <code> pinRunner.js </code> when Person 2 wires it up. This shell
        dispatches <code>RUN_PIN</code> and reports the pipeline result.
      </p>
    </section>
  );
}
