// src/core/robotStore.js

/**
 * Global state store for the robot arm simulation.
 * Implements a simple subscriber pattern to allow React components (Person 3)
 * and the 3D scene (Person 1) to listen for updates without external dependencies.
 */

// Initial state schema
let state = {
  // Current 6 joint angles in radians
  jointAngles: [0, 0, 0, 0, 0, 0],

  // Current end-effector position in meters (calculated via FK)
  eePosition: { x: 0.5, y: 0.0, z: 0.05 },

  // Target end-effector position in meters (controlled by manual/voice inputs)
  targetPosition: { x: 0.5, y: 0.0, z: 0.05 },

  // System safety state
  safety: {
    tripped: false,
    message: null,
    violationCount: 0
  },

  // Motion controller state
  motion: {
    isMoving: false,
    activeCommandSource: null, // 'keyboard', 'joystick', 'voice', 'autonomous'
    activeTrajectoryPath: []    // Array of {x, y, z} points currently being traversed
  },

  // Log system containing logs: { id, timestamp, type, message }
  logs: []
};

const listeners = new Set();

export const robotStore = {
  /**
   * Retrieve the current state.
   */
  getState() {
    return state;
  },

  /**
   * Subscribe to state changes.
   * @param {Function} listener callback receiving the new state
   * @returns {Function} unsubscribe function
   */
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /**
   * Update specific parts of the state and notify listeners.
   * @param {Object|Function} nextState
   */
  setState(nextState) {
    const changes = typeof nextState === 'function' ? nextState(state) : nextState;
    state = { ...state, ...changes };
    listeners.forEach((listener) => listener(state));
  },

  /**
   * Reset store to initial defaults.
   */
  reset() {
    this.setState({
      jointAngles: [0, 0, 0, 0, 0, 0],
      eePosition: { x: 0.5, y: 0.0, z: 0.05 },
      targetPosition: { x: 0.5, y: 0.0, z: 0.05 },
      safety: { tripped: false, message: null, violationCount: 0 },
      motion: { isMoving: false, activeCommandSource: null, activeTrajectoryPath: [] },
      logs: []
    });
  }
};
