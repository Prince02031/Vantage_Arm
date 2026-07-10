// src/components/KeyboardHelp.jsx
import { useEffect } from 'react';
import { createKeyboardAdapter, KEYBOARD_BINDINGS } from '../controls/keyboardCommands.js';
import { executeCommand } from '../core/motionPipeline.js';

export default function KeyboardHelp() {
  // Install a paired keydown + keyup listener while this panel is mounted.
  // The cleanup function is returned directly from `install(...)`, so React
  // tears it down on unmount and we don't leak listeners.
  useEffect(() => {
    const adapter = createKeyboardAdapter({ executeCommand });
    const uninstall = adapter.install(window);
    return uninstall;
  }, []);

  return (
    <section className="keyboard-help" aria-label="Keyboard controls">
      <header className="keyboard-help-header">
        <h3>Keyboard</h3>
        <span className="panel-subtitle">Click anywhere outside a text input, then press a key</span>
      </header>
      <div className="keyboard-bindings">
        {KEYBOARD_BINDINGS.map((group) => (
          <div key={group.group} className="keyboard-group">
            <h4>{group.group}</h4>
            <ul>
              {group.entries.map((entry, i) => (
                <li key={i}>
                  <span className="kbd">{entry.keys.join(' / ')}</span>
                  <span className="kbd-label">{entry.label}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="keyboard-hint">
        Held keys do not spam commands — the first press dispatches once and
        the listener releases on key-up. Keystrokes inside any
        <code> &lt;input&gt; </code> or <code>&lt;textarea&gt;</code> are
        ignored, so the Voice / Move-To / PIN panels stay usable.
      </p>
    </section>
  );
}

