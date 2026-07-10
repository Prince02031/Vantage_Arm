// App.jsx
import { useState, useCallback, useRef } from 'react';
import ThreeScene from './scene/ThreeScene.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function App() {
  const [joints, setJoints] = useState({});
  const [eef, setEef] = useState(null);
  const [limits, setLimits] = useState({});
  const [operatorIdx, setOperatorIdx] = useState(0);
  const limitsSet = useRef(false);

  const handleStateUpdate = useCallback(({ joints: j, eef: e, limits: l }) => {
    setJoints(prev => {
      const same = Object.keys(j).every(k => prev[k] === j[k]);
      return same ? prev : j;
    });
    setEef(e);
    // Limits only arrive once (from adapter); cache them
    if (l && !limitsSet.current) {
      limitsSet.current = true;
      setLimits(l);
    }
  }, []);

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
