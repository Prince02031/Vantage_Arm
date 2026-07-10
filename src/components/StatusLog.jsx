// src/components/StatusLog.jsx
// Subscribes to robotStore.logs and renders an entry-per-line log with a
// colored level chip. Person 2's motion pipeline pushes entries into logs;
// we only render.
import { useRobotStore } from '../utils/useRobotStore.js';
import { formatTime } from '../utils/formatters.js';

const LEVEL_CLASS = {
  INFO:    'level-info',
  SUCCESS: 'level-success',
  WARNING: 'level-warning',
  ERROR:   'level-error'
};

function inferLevel(entry) {
  if (entry.level) return entry.level.toUpperCase();
  if (entry.type) return entry.type.toUpperCase();
  // Fall back to message-shape heuristics so older entries still render nicely.
  const msg = (entry.message || '').toLowerCase();
  if (msg.includes('error') || msg.includes('halt')) return 'ERROR';
  if (msg.includes('fail') || msg.includes('reject') || msg.includes('warn')) return 'WARNING';
  if (msg.includes('accept') || msg.includes('complete') || msg.includes('reset')) return 'SUCCESS';
  return 'INFO';
}

export default function StatusLog() {
  const { logs } = useRobotStore();
  const entries = Array.isArray(logs) ? logs : [];

  return (
    <section className="status-log" aria-label="Status log">
      <header className="status-log-header">
        <h3>Status Log</h3>
        <span className="status-log-count">{entries.length} entr{entries.length === 1 ? 'y' : 'ies'}</span>
      </header>
      <div className="status-log-body">
        {entries.length === 0 ? (
          <div className="status-log-empty">
            <p>No status events yet.</p>
            <small>Trigger a control (joystick, keyboard, voice, or PIN entry) to see pipeline output here.</small>
          </div>
        ) : (
          <ul className="status-log-list">
            {entries.slice().reverse().map((entry, i) => {
              const level = inferLevel(entry);
              const ts = entry.timestamp || entry.time || entry.id;
              return (
                <li key={entry.id || i} className={`status-log-item ${LEVEL_CLASS[level] || ''}`}>
                  <span className={`level-chip ${LEVEL_CLASS[level] || 'level-info'}`}>{level}</span>
                  <div className="status-log-content">
                    <div className="status-log-row">
                      <span className="status-log-time">{formatTime(ts)}</span>
                      {entry.source && (
                        <span className="status-log-source">via {entry.source}</span>
                      )}
                      {entry.commandType && (
                        <span className="status-log-cmd">{entry.commandType}</span>
                      )}
                    </div>
                    <div className="status-log-message">{entry.message || '(no message)'}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
