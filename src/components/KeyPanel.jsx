// src/components/KeyPanel.jsx
// Renders the 6 keys from /key.config.json. Click to call TAP_KEY.
import { useEffect, useState } from 'react';
import keyConfig from '../../key.config.json';
import { executeCommand } from '../core/motionPipeline.js';
import { CommandTypes } from '../core/commandTypes.js';

export default function KeyPanel() {
  const [config, setConfig] = useState(keyConfig);

  // If Person 1 fetches a different config at runtime, prefer that.
  useEffect(() => {
    fetch('/config/key.config.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setConfig(j))
      .catch(() => { /* ignore */ });
  }, []);

  const keys = config.keys || {};

  const handleTap = (keyId) => {
    executeCommand({
      type: CommandTypes.TAP_KEY,
      payload: { keyId },
      source: 'dashboard'
    });
  };

  return (
    <div className="key-panel">
      <header className="key-panel-header">
        <h3>Test Keys</h3>
        <span className="key-panel-meta">frame: {config.frame || 'base_link'}</span>
      </header>
      <div className="key-grid">
        {Object.entries(keys).map(([id, coord]) => (
          <button
            key={id}
            type="button"
            className="key-cell"
            onClick={() => handleTap(id)}
            title={`(${coord.x}, ${coord.y}, ${coord.z})`}
          >
            <span className="key-id">{id}</span>
            <span className="key-coord">{coord.x.toFixed(2)}, {coord.y.toFixed(2)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
