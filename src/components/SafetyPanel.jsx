// src/components/SafetyPanel.jsx
import React, { useState, useEffect } from 'react';
import { 
  getRobotState, 
  subscribeRobotState, 
  clearStopRequest 
} from '../core/robotStore.js';
import { 
  stopMotion, 
  getPipelineStatus 
} from '../core/motionPipeline.js';
import { WORKSPACE_BOUNDS } from '../core/commandTypes.js';

export default function SafetyPanel() {
  const [state, setState] = useState(getRobotState());
  const [status, setStatus] = useState(getPipelineStatus());

  useEffect(() => {
    // Subscribe to state updates to render reactively
    const unsubscribe = subscribeRobotState((newState) => {
      setState(newState);
      setStatus(getPipelineStatus());
    });
    return unsubscribe;
  }, []);

  const handleEmergencyStop = () => {
    stopMotion();
  };

  const handleClearStop = () => {
    clearStopRequest();
    setState(getRobotState());
    setStatus(getPipelineStatus());
  };

  const isSafetyValid = state.safety.lastValid;
  const lastMessage = state.safety.lastMessage;
  const isStopped = status.stopRequested;
  const ee = state.endEffectorPosition || { x: 0, y: 0, z: 0 };

  // Helper check for highlighting bounds violations
  const xOutOfBound = ee.x < WORKSPACE_BOUNDS.x.min || ee.x > WORKSPACE_BOUNDS.x.max;
  const yOutOfBound = ee.y < WORKSPACE_BOUNDS.y.min || ee.y > WORKSPACE_BOUNDS.y.max;
  const zOutOfBound = ee.z < WORKSPACE_BOUNDS.z.min || ee.z > WORKSPACE_BOUNDS.z.max;

  return (
    <div style={styles.panelContainer(isSafetyValid, isStopped)}>
      {/* Header with status badges */}
      <div style={styles.header}>
        <h3 style={styles.title}>Safety & System Pipeline</h3>
        <div style={styles.badgeRow}>
          <span style={styles.badge(isSafetyValid ? 'success' : 'error')}>
            {isSafetyValid ? 'SYSTEM SECURE' : 'SAFETY TRIPPED'}
          </span>
          {isStopped && (
            <span style={styles.badge('warning')}>
              ESTOP ACTIVE
            </span>
          )}
        </div>
      </div>

      {/* Safety message log banner */}
      <div style={styles.messageBox(isSafetyValid)}>
        <strong style={{ fontSize: '12px', color: '#888' }}>Status Detail:</strong>
        <p style={styles.messageText}>{lastMessage}</p>
      </div>

      {/* Workspace live values vs limit boundaries */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Workspace Envelopes (meters)</h4>
        <div style={styles.grid}>
          {/* X Axis */}
          <div style={styles.gridRow(xOutOfBound)}>
            <span style={styles.axisLabel}>X Axis</span>
            <span style={styles.valueText}>{ee.x.toFixed(3)}m</span>
            <span style={styles.limitText}>
              [{WORKSPACE_BOUNDS.x.min.toFixed(2)} to {WORKSPACE_BOUNDS.x.max.toFixed(2)}]
            </span>
          </div>

          {/* Y Axis */}
          <div style={styles.gridRow(yOutOfBound)}>
            <span style={styles.axisLabel}>Y Axis</span>
            <span style={styles.valueText}>{ee.y.toFixed(3)}m</span>
            <span style={styles.limitText}>
              [{WORKSPACE_BOUNDS.y.min.toFixed(2)} to {WORKSPACE_BOUNDS.y.max.toFixed(2)}]
            </span>
          </div>

          {/* Z Axis */}
          <div style={styles.gridRow(zOutOfBound)}>
            <span style={styles.axisLabel}>Z Axis</span>
            <span style={styles.valueText}>{ee.z.toFixed(3)}m</span>
            <span style={styles.limitText}>
              [{WORKSPACE_BOUNDS.z.min.toFixed(2)} to {WORKSPACE_BOUNDS.z.max.toFixed(2)}]
            </span>
          </div>
        </div>
      </div>

      {/* Pipeline connection state logs */}
      <div style={styles.section}>
        <h4 style={styles.sectionTitle}>Pipeline Metadata</h4>
        <div style={styles.metaList}>
          <div style={styles.metaRow}>
            <span>Adapter Connection:</span>
            <strong style={{ color: status.adapter === 'registered' ? '#10b981' : '#f59e0b' }}>
              {status.adapter.toUpperCase()}
            </strong>
          </div>
          <div style={styles.metaRow}>
            <span>Active Trajectory:</span>
            <span>{state.isMoving ? 'RUNNING' : 'IDLE'}</span>
          </div>
          <div style={styles.metaRow}>
            <span>Current Command:</span>
            <span style={styles.commandCode}>
              {state.activeCommand ? JSON.stringify(state.activeCommand) : 'null'}
            </span>
          </div>
        </div>
      </div>

      {/* Trigger Buttons */}
      <div style={styles.buttonRow}>
        <button 
          onClick={handleEmergencyStop} 
          style={styles.estopButton}
        >
          EMERGENCY STOP
        </button>
        
        {isStopped && (
          <button 
            onClick={handleClearStop} 
            style={styles.resetButton}
          >
            CLEAR ESTOP
          </button>
        )}
      </div>
    </div>
  );
}

const styles = {
  panelContainer: (isSafetyValid, isStopped) => {
    let borderColor = 'rgba(255, 255, 255, 0.1)';
    let glow = 'none';

    if (!isSafetyValid) {
      borderColor = 'rgba(239, 68, 68, 0.4)';
      glow = '0 0 20px rgba(239, 68, 68, 0.15)';
    } else if (isStopped) {
      borderColor = 'rgba(245, 158, 11, 0.4)';
      glow = '0 0 20px rgba(245, 158, 11, 0.15)';
    }

    return {
      padding: '24px',
      borderRadius: '16px',
      backgroundColor: 'rgba(20, 20, 24, 0.65)',
      backdropFilter: 'blur(12px)',
      border: `1px solid ${borderColor}`,
      boxShadow: glow,
      color: '#ffffff',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      maxWidth: '480px',
      margin: '0 auto',
      transition: 'all 0.3s ease'
    };
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '20px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
    paddingBottom: '12px'
  },
  title: {
    margin: 0,
    fontSize: '18px',
    fontWeight: '600',
    letterSpacing: '-0.3px',
    color: '#f3f4f6'
  },
  badgeRow: {
    display: 'flex',
    gap: '8px'
  },
  badge: (type) => {
    let bg = 'rgba(255, 255, 255, 0.08)';
    let color = '#ffffff';

    if (type === 'success') {
      bg = 'rgba(16, 185, 129, 0.15)';
      color = '#34d399';
    } else if (type === 'error') {
      bg = 'rgba(239, 68, 68, 0.15)';
      color = '#f87171';
    } else if (type === 'warning') {
      bg = 'rgba(245, 158, 11, 0.15)';
      color = '#fbbf24';
    }

    return {
      padding: '4px 10px',
      borderRadius: '20px',
      fontSize: '11px',
      fontWeight: '700',
      letterSpacing: '0.5px',
      backgroundColor: bg,
      color: color,
      border: `1px solid ${color}33`
    };
  },
  messageBox: (isSafetyValid) => ({
    padding: '12px 16px',
    borderRadius: '8px',
    backgroundColor: isSafetyValid ? 'rgba(255, 255, 255, 0.03)' : 'rgba(239, 68, 68, 0.05)',
    borderLeft: `3px solid ${isSafetyValid ? '#4b5563' : '#ef4444'}`,
    marginBottom: '20px'
  }),
  messageText: {
    margin: '4px 0 0 0',
    fontSize: '13px',
    lineHeight: '1.4',
    color: '#e5e7eb'
  },
  section: {
    marginBottom: '20px'
  },
  sectionTitle: {
    margin: '0 0 10px 0',
    fontSize: '13px',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    color: '#9ca3af'
  },
  grid: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  gridRow: (isViolated) => ({
    display: 'grid',
    gridTemplateColumns: '80px 100px 1fr',
    alignItems: 'center',
    padding: '10px 12px',
    borderRadius: '6px',
    backgroundColor: isViolated ? 'rgba(239, 68, 68, 0.08)' : 'rgba(255, 255, 255, 0.02)',
    border: `1px solid ${isViolated ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.04)'}`,
    fontSize: '13px',
    transition: 'background-color 0.2s'
  }),
  axisLabel: {
    fontWeight: '600',
    color: '#d1d5db'
  },
  valueText: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    fontSize: '14px'
  },
  limitText: {
    textAlign: 'right',
    color: '#6b7280',
    fontFamily: 'monospace',
    fontSize: '12px'
  },
  metaList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '12px',
    borderRadius: '8px',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    border: '1px solid rgba(255, 255, 255, 0.04)',
    fontSize: '13px'
  },
  metaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  commandCode: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: '#9ca3af',
    maxWidth: '220px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px'
  },
  estopButton: {
    flex: 1,
    padding: '14px 0',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: '#ef4444',
    color: '#ffffff',
    fontSize: '13px',
    fontWeight: '700',
    letterSpacing: '0.5px',
    cursor: 'pointer',
    transition: 'background-color 0.2s, transform 0.1s',
    boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)'
  },
  resetButton: {
    padding: '14px 20px',
    borderRadius: '8px',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    color: '#f3f4f6',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.2s'
  }
};
