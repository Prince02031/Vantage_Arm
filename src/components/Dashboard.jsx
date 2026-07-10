// src/components/Dashboard.jsx
import ThreeScene from '../scene/ThreeScene.jsx';
import KeyPanel from '../scene/KeyPanel.jsx';
import StatusLog from './StatusLog.jsx';
import SafetyPanel from './SafetyPanel.jsx';
import JointPanel from './JointPanel.jsx';
import JoystickPanel from './JoystickPanel.jsx';
import TargetInputPanel from './TargetInputPanel.jsx';
import KeyboardHelp from './KeyboardHelp.jsx';
import VoicePanel from './VoicePanel.jsx';
import PinEntryPanel from './PinEntryPanel.jsx';

export default function Dashboard() {
  return (
    <div className="dashboard">
      <header className="dashboard-topbar">
        <div className="dashboard-brand">
          <span className="dashboard-logo">VA</span>
          <div>
            <h1>Vantage Arm</h1>
            <small>6-DOF Robotic Arm Simulator · Operator Dashboard</small>
          </div>
        </div>
        <div className="dashboard-phase">
          <span className="phase-tag">Phase B · Controls &amp; Dashboard</span>
        </div>
      </header>

      <main className="dashboard-grid">
        <section className="dashboard-scene" aria-label="Robot scene">
          <ThreeScene />
          <KeyPanel />
        </section>

        <aside className="dashboard-controls" aria-label="Controls panel">
          <JointPanel />
          <SafetyPanel />
          <JoystickPanel />
          <TargetInputPanel />
          <KeyboardHelp />
          <VoicePanel />
          <PinEntryPanel />
        </aside>

        <footer className="dashboard-status" aria-label="Status">
          <StatusLog />
        </footer>
      </main>
    </div>
  );
}

