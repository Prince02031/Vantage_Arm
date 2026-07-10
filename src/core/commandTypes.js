// src/core/commandTypes.js

/**
 * Standard movement and control command types.
 * All trigger sources (keyboard, joystick, voice, autonomous runner)
 * must dispatch commands using these types.
 */
export const CommandTypes = {
  // Cartesian End-Effector Commands
  MOVE_EE: 'MOVE_EE',         // Jog end-effector relative step { dx, dy, dz }
  SET_EE: 'SET_EE',           // Move end-effector to absolute { x, y, z }

  // Joint Space Commands
  JOG_JOINT: 'JOG_JOINT',     // Step specific joint angle { jointId, delta }
  SET_JOINTS: 'SET_JOINTS',   // Set absolute joint angles { angles: [q1, q2, q3, q4, q5, q6] }

  // Autonomous / Automation Commands
  TAP_KEY: 'TAP_KEY',         // Perform hover-touch-retract on key { keyId }
  EXECUTE_PIN: 'EXECUTE_PIN', // Perform autonomous sequence on 6-digit PIN { pin }

  // System Controls
  HALT: 'HALT',               // Immediately stop all active motion
  RESET_SAFETY: 'RESET_SAFETY'// Reset safety trip/error states
};
