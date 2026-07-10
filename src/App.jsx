// App.jsx
import { useState, useCallback, useEffect } from 'react';
import ThreeScene from './scene/ThreeScene.jsx';
import Dashboard from './components/Dashboard.jsx';
import { subscribeRobotState, getRobotState, setRobotState } from './core/robotStore.js';

export default function App() {
  const [robotState, setRState] = useState(() => getRobotState());

  useEffect(() => {
    const unsub = subscribeRobotState((next) => {
      setRState(next);
    });
    return unsub;
  }, []);

  const handleStateUpdate = useCallback(({ joints: j, eef: e, limits: l }) => {
    const update = {
      jointAngles: j,
      endEffectorPosition: e
    };
    if (l && Object.keys(l).length > 0) {
      update.jointLimits = l;
    }
    setRobotState(update);
  }, []);

  const joints = robotState.jointAngles || {};
  const eef = robotState.endEffectorPosition;
  const limits = robotState.jointLimits || {};

  // Operational operator Profile toggle state
  const [operatorIdx, setOperatorIdx] = useState(0);

  return (
    <div className="app-root">
      <header className="app-header">
        <h1>Vantage Arm</h1>
        <p>6-DOF Browser Simulator — Phase B</p>
      </header>
      <main className="app-main">
        <ThreeScene onStateUpdate={handleStateUpdate} />
        <Dashboard
          joints={joints}
          eef={eef}
          limits={limits}
          operatorIdx={operatorIdx}
          onOperatorChange={setOperatorIdx}
        />
      </main>
    </div>
  );
}
