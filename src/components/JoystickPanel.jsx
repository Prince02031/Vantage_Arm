// src/components/JoystickPanel.jsx
import { useMemo } from 'react';
import { executeCommand } from '../core/motionPipeline.js';
import { createJoystickAdapter } from '../controls/joystickCommands.js';

const EE_STEP = 0.02; // meters per click (per Phase B spec default)

export default function JoystickPanel() {
  // Build the adapter once — it captures executeCommand by reference.
  const adapter = useMemo(
    () => createJoystickAdapter({ executeCommand, defaultDelta: EE_STEP }),
    []
  );

  return (
    <section className="joystick-panel" aria-label="Joystick controls">
      <header className="joystick-panel-header">
        <h3>Joystick</h3>
        <span className="panel-subtitle">On-screen GUI joystick · EE step {EE_STEP} m</span>
      </header>

      <div className="joystick-block">
        <h4>End-Effector (Cartesian)</h4>
        <div className="joystick-pad">
          <button type="button" className="btn btn-joy btn-joy-axis" onClick={() => adapter.xPlus()}>X+</button>
          <button type="button" className="btn btn-joy btn-joy-axis" onClick={() => adapter.yPlus()}>Y+</button>
          <button type="button" className="btn btn-joy btn-joy-axis" onClick={() => adapter.zPlus()}>Z+</button>
          <button type="button" className="btn btn-joy btn-joy-axis" onClick={() => adapter.xMinus()}>X−</button>
          <button type="button" className="btn btn-joy btn-joy-axis" onClick={() => adapter.yMinus()}>Y−</button>
          <button type="button" className="btn btn-joy btn-joy-axis" onClick={() => adapter.zMinus()}>Z−</button>
        </div>
        <p className="joystick-hint">All buttons dispatch through <code>executeCommand</code>.</p>
      </div>

      <div className="joystick-block">
        <h4>System</h4>
        <div className="joystick-row">
          <button type="button" className="btn btn-primary" onClick={() => adapter.home()}>Home</button>
          <button type="button" className="btn btn-danger"  onClick={() => adapter.stop()}>Stop</button>
        </div>
      </div>
    </section>
  );
}

