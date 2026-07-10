// src/components/StatusLog.jsx
// Phase C: rich log view — shows source, command type, level chip, message, timestamp.
// Entries come from robotStore.logs pushed by the motion pipeline; we only render.
import { useState } from 'react';
import { useRobotStore } from '../utils/useRobotStore.js';
import { formatTime } from '../utils/formatters.js';

const MAX_DISPLAY = 60;

const LEVEL_CLASS = {
  INFO:    'level-info',
  SUCCESS: 'level-success',
  WARNING: 'level-warning',
  ERROR:   'level-error'
};

const LEVEL_ICON = {
  INFO:    'ℹ',
  SUCCESS: '✓',
  WARNING: '⚠',
  ERROR:   '✗'
};

function inferLevel(entry) {
  if (entry.level) return entry.level.toUpperCase();
  if (entry.type) return entry.type.toUpperCase();
  const msg = (entry.message || '').toLowerCase();
  if (msg.includes('error') || msg.includes('halt') || msg.includes('fail')) return 'ERROR';
  if (msg.includes('warn') || msg.includes('reject') || msg.includes('miss')) return 'WARNING';
  if (msg.includes('success') || msg.includes('complete') || msg.includes('ok') || msg.includes('solved')) return 'SUCCESS';
  return 'INFO';
}

function fmtCommandType(ct) {
  if (!ct) return null;
  return ct.replace(/([A-Z])/g, ' $1').trim().toUpperCase();
}

export default function StatusLog() {
  const { logs } = useRobotStore();
  const [pinned, setPinned] = useState(false);
  const allEntries = Array.isArray(logs) ? logs : [];
  const entries = allEntries.slice(-MAX_DISPLAY);

  const displayEntries = pinned ? entries : entries.slice().reverse();

  return (
    <section className="status-log" aria-label="Status log">
      <header className="status-log-header">
        <div className="status-log-title">
          <h3>Status Log</h3>
          <span className="status-log-count">
            {allEntries.length} event{allEntries.length !== 1 ? 's' : ''}
            {allEntries.length > MAX_DISPLAY && ` (showing latest ${MAX_DISPLAY})`}
          </span>
        </div>
        <div className="status-log-actions">
          <button
            type="button"
            className={`btn btn-sm ${pinned ? 'btn-secondary' : 'btn-ghost'}`}
            onClick={() => setPinned(p => !p)}
            title={pinned ? 'Show newest first' : 'Show oldest first'}
          >
            {pinned ? '↑ Oldest' : '↓ Newest'}
          </button>
        </div>
      </header>

      <div className="status-log-body">
        {entries.length === 0 ? (
          <div className="status-log-empty">
            <p>No status events yet.</p>
            <small>
              Trigger a command (joystick, keyboard, Press Key, Move To, voice, or PIN)
              to see pipeline output here.
            </small>
          </div>
        ) : (
          <ul className="status-log-list">
            {displayEntries.map((entry, i) => {
              const level = inferLevel(entry);
              const ts = entry.timestamp || entry.time || entry.id;
              const cmdType = fmtCommandType(entry.commandType);
              return (
                <li
                  key={entry.id || i}
                  className={`status-log-item ${LEVEL_CLASS[level] || 'level-info'}`}
                >
                  <span
                    className={`level-chip ${LEVEL_CLASS[level] || 'level-info'}`}
                    title={level}
                  >
                    {LEVEL_ICON[level] || '·'} {level}
                  </span>
                  <div className="status-log-content">
                    <div className="status-log-row">
                      <span className="status-log-time">{formatTime(ts)}</span>
                      {entry.source && (
                        <span className="status-log-source" title="Command source">
                          via {entry.source}
                        </span>
                      )}
                      {cmdType && (
                        <span className="status-log-cmd" title="Command type">
                          {cmdType}
                        </span>
                      )}
                    </div>
                    <div className={`status-log-message ${level === 'ERROR' ? 'status-log-message--error' : ''}`}>
                      {entry.message || '(no message)'}
                    </div>
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
