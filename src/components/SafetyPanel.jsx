// src/components/SafetyPanel.jsx
import { useRobotStore } from '../utils/useRobotStore.js';
import { executeCommand } from '../core/motionPipeline.js';
import { CommandTypes } from '../core/commandTypes.js';

function deriveSystemState(safety, motion) {
  if (safety?.tripped) return { key: 'tripped', label: 'Tripped (Safety)', tone: 'danger' };
  if (motion?.isMoving) return { key: 'moving',  label: 'Moving',           tone: 'active' };
  return { key: 'ready', label: 'Ready', tone: 'ok' };
}

export default function SafetyPanel() {
  const { safety, motion, lastKeyPressResult } = useRobotStore();
  const sys = deriveSystemState(safety, motion);
  const adapterStatus = {
    name: 'motionPipeline (Phase C)',
    available: typeof executeCommand === 'function',
    source: motion?.activeCommandSource || 'idle'
  };

  const handleReset = () => {
    executeCommand({ type: CommandTypes.RESET_SAFETY, payload: {}, source: 'dashboard' });
  };
  const handleHalt = () => {
    executeCommand({ type: CommandTypes.HALT, payload: {}, source: 'dashboard' });
  };

  return (
    <section className="safety-panel" aria-label="Safety">
      <header className="safety-panel-header">
        <h3>Safety</h3>
        <span className={`system-pill system-pill-${sys.tone}`}>{sys.label}</span>
      </header>
      <div className="safety-panel-body">
        <div className="safety-row">
          <span className="safety-label">Last validation</span>
          <span className={`safety-message ${safety?.tripped ? 'safety-message-error' : 'safety-message-ok'}`}>
            {safety?.message || (safety?.tripped ? 'Tripped' : 'All checks passing.')}
          </span>
        </div>
        <div className="safety-row">
          <span className="safety-label">Violations</span>
          <span className="safety-value">{safety?.violationCount ?? 0}</span>
        </div>
        <div className="safety-row">
          <span className="safety-label">IK Status</span>
          <span className={`safety-value ${safety?.ikSolved === false ? 'bad' : safety?.ikSolved === true ? 'ok' : ''}`}>
            {safety?.ikSolved === true ? `Solved (err: ${safety?.ikError?.toFixed?.(4) ?? '?'}m)` 
              : safety?.ikSolved === false ? 'Failed'
              : 'Idle'}
          </span>
        </div>
        <div className="safety-row">
          <span className="safety-label">Active source</span>
          <span className="safety-value">{motion?.activeCommandSource || 'idle'}</span>
        </div>
        <div className="safety-row">
          <span className="safety-label">Adapter</span>
          <span className="safety-value">{adapterStatus.name}</span>
        </div>
        <div className="safety-row">
          <span className="safety-label">Available</span>
          <span className={`safety-value ${adapterStatus.available ? 'ok' : 'bad'}`}>
            {adapterStatus.available ? 'yes' : 'no'}
          </span>
        </div>
        {lastKeyPressResult && (
          <div className="safety-row">
            <span className="safety-label">Last Key Press</span>
            <span className={`safety-value ${lastKeyPressResult.success ? 'ok' : 'bad'}`}>
              Key [{lastKeyPressResult.key}] — {lastKeyPressResult.success ? 'OK' : 'MISS'} ({(lastKeyPressResult.errorM * 1000).toFixed(1)}mm)
            </span>
          </div>
        )}
        <div className="safety-actions">
          <button type="button" className="btn btn-danger" onClick={handleHalt}>Emergency Halt</button>
          <button type="button" className="btn btn-secondary" onClick={handleReset}>Reset Safety</button>
        </div>
      </div>
    </section>
  );
}
