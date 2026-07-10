// src/core/robotStore.js

/**
 * Initial state schema for the Vantage Arm.
 * Represents a comprehensive model of the robot's current physical,
 * safety, mode, and execution parameters.
 */
let state = {
  jointAngles: {}, // e.g., { joint_1: 0.0, joint_2: 0.0, ... }
  movableJoints: [], // Array of names, e.g., ['joint_1', 'joint_2', ...]
  jointLimits: {}, // e.g., { joint_1: { min: -3.14, max: 3.14 }, ... }
  endEffectorPosition: { x: 0, y: 0, z: 0 },
  targetPosition: null, // target coordinates { x, y, z }
  activeCommand: null, // currently executing command object
  isMoving: false,
  mode: "idle", // 'idle', 'manual', 'jogging', 'autonomous', 'halted'
  pinProgress: {
    pin: "",
    currentIndex: 0,
    pressed: [],
    failed: false,
    complete: false
  },
  safety: {
    lastValid: true,
    lastMessage: "Ready",
    lastSafetyResult: null
  },
  statusLog: []
};

// Internal module state
let robotAdapter = null;
let activeTrajectory = null;
let stopRequested = false;

// Set of active subscribers
const listeners = new Set();

/**
 * Retrieves a read-only copy of the current state.
 * @returns {Object} Current state object
 */
export function getRobotState() {
  // Return a shallow copy of the state structure
  const jointAnglesCopy = { ...state.jointAngles };
  // Add numerical indices for Person 3's UI compatibility:
  const jointNames = ['joint_1', 'joint_2', 'joint_3', 'joint_4', 'joint_5', 'joint_6'];
  jointNames.forEach((name, idx) => {
    if (name in jointAnglesCopy) {
      jointAnglesCopy[idx] = jointAnglesCopy[name];
    }
  });

  return {
    ...state,
    jointAngles: jointAnglesCopy,
    endEffectorPosition: { ...state.endEffectorPosition },
    targetPosition: state.targetPosition ? { ...state.targetPosition } : null,
    activeCommand: state.activeCommand ? { ...state.activeCommand } : null,
    pinProgress: { ...state.pinProgress, pressed: [...state.pinProgress.pressed] },
    safety: { 
      ...state.safety,
      tripped: !state.safety.lastValid,
      message: state.safety.lastMessage,
      violationCount: state.safety.violationCount || 0
    },
    statusLog: [...state.statusLog],
    
    // Compatibility aliases:
    logs: [...state.statusLog],
    eePosition: { ...state.endEffectorPosition },
    motion: {
      isMoving: state.isMoving,
      activeCommandSource: state.activeCommand ? state.activeCommand.source : 'idle'
    }
  };
}

/**
 * Updates the robot store state. Merges partial updates.
 * Deep merges safety, pinProgress structures if provided.
 * @param {Object} partial - Partial state updates
 */
export function setRobotState(partial) {
  if (!partial || typeof partial !== "object") return;

  // Bidirectional sync for joint names vs indices
  if (partial.jointAngles) {
    const jointNames = ['joint_1', 'joint_2', 'joint_3', 'joint_4', 'joint_5', 'joint_6'];
    const updatedAngles = { ...state.jointAngles, ...partial.jointAngles };
    jointNames.forEach((name, idx) => {
      if (idx in partial.jointAngles) {
        updatedAngles[name] = partial.jointAngles[idx];
      }
      if (name in partial.jointAngles) {
        updatedAngles[idx] = partial.jointAngles[name];
      }
    });
    partial.jointAngles = updatedAngles;
  }

  // Bidirectional sync for safety
  if (partial.safety) {
    const nextSafety = { ...state.safety, ...partial.safety };
    if ('tripped' in partial.safety) {
      nextSafety.lastValid = !partial.safety.tripped;
    }
    if ('message' in partial.safety) {
      nextSafety.lastMessage = partial.safety.message;
    }
    if (partial.safety.tripped && !state.safety.tripped) {
      nextSafety.violationCount = (state.safety.violationCount || 0) + 1;
    }
    partial.safety = nextSafety;
  }

  const nextState = { ...state, ...partial };

  // Handle nested object updates safely
  if (partial.pinProgress) {
    nextState.pinProgress = { ...state.pinProgress, ...partial.pinProgress };
  }
  if (partial.safety) {
    nextState.safety = { ...state.safety, ...partial.safety };
  }

  state = nextState;
  
  // Notify listeners
  listeners.forEach(listener => {
    try {
      listener(getRobotState());
    } catch (err) {
      console.error("Error in robotStore subscriber callback:", err);
    }
  });
}

/**
 * Subscribe to state changes.
 * @param {Function} listener - Callback function receiving the updated state
 * @returns {Function} Unsubscribe function
 */
export function subscribeRobotState(listener) {
  if (typeof listener !== "function") {
    throw new Error("robotStore listener must be a function.");
  }
  listeners.add(listener);
  
  // Return unsubscribe handler
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Adds an entry to the status log and notifies subscribers.
 * @param {Object} entry - Log entry details
 * @param {string} [entry.level="info"] - 'info', 'success', 'warning', 'error'
 * @param {string} entry.message - Log content
 * @param {string} [entry.source="unknown"] - Origin of log
 * @param {string} [entry.commandType=null] - Accompanying command type
 */
export function addStatusLog(entry) {
  if (!entry || !entry.message) return;

  const newLog = {
    id: entry.id || String(Date.now()) + Math.random().toString(36).substring(2, 7),
    level: entry.level || "info",
    message: String(entry.message),
    timestamp: entry.timestamp || new Date().toLocaleTimeString(),
    source: entry.source || "unknown",
    commandType: entry.commandType || null
  };

  setRobotState({
    statusLog: [...state.statusLog, newLog]
  });
}

/**
 * Clears the status logs array.
 */
export function clearStatusLog() {
  setRobotState({ statusLog: [] });
}

/**
 * Registers the physical/visual robot simulation adapter (Three.js integration wrapper).
 * @param {Object} adapter - Interface referencing Three.js objects
 */
export function setRobotAdapter(adapter) {
  robotAdapter = adapter;
}

/**
 * Retrieves the currently registered robot adapter.
 * @returns {Object|null} The registered adapter interface
 */
export function getRobotAdapter() {
  return robotAdapter;
}

/**
 * Stores the active trajectory object (useful for interpolation checks or cancels).
 * @param {Object|null} trajectory - Active trajectory details
 */
export function setActiveTrajectory(trajectory) {
  activeTrajectory = trajectory;
}

/**
 * Retrieves the currently active trajectory.
 * @returns {Object|null} Current trajectory object
 */
export function getActiveTrajectory() {
  return activeTrajectory;
}

/**
 * Triggers a stop request (stops joint movements or pin sequences immediately).
 */
export function requestStop() {
  stopRequested = true;
}

/**
 * Resets the stop request state.
 */
export function clearStopRequest() {
  stopRequested = false;
}

/**
 * Checks if a stop has been requested.
 * @returns {boolean} True if stop is active
 */
export function isStopRequested() {
  return stopRequested;
}
