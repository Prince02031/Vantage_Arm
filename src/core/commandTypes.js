// src/core/commandTypes.js

/**
 * Standard movement and control command types.
 * All trigger sources (keyboard, joystick, voice, autonomous runner)
 * must dispatch commands using these types.
 *
 * Two generations of command shapes are supported:
 *   1. Legacy "delta" commands (MOVE_EE / JOG_JOINT / SET_EE / SET_JOINTS)
 *      — kept for backwards compatibility with adapters written in
 *      Phase A/early Phase B.
 *   2. New control commands used by the wired-up Phase B controls:
 *        JOG_AXIS  — Cartesian axis jog { axis, delta, mode? }
 *        HOME      — Return to home pose
 *        STOP      — Halt in place (latched safety halt)
 *        MOVE_TO   — Absolute EE target { target: {x,y,z} }
 *        RUN_PIN   — Autonomous 6-digit PIN run { pin }
 */
export const CommandTypes = {
  // Cartesian End-Effector Commands
  MOVE_EE: 'MOVE_EE',         // Jog end-effector relative step { dx, dy, dz }
  SET_EE: 'SET_EE',           // Move end-effector to absolute { x, y, z }
  JOG_AXIS: 'JOG_AXIS',       // Jog end-effector along a single axis { axis, delta, mode? }
  MOVE_TO: 'MOVE_TO',         // Move end-effector to absolute target { target: {x,y,z} }

  // Joint Space Commands
  JOG_JOINT: 'JOG_JOINT',     // Step specific joint angle { jointId, delta }
  SET_JOINTS: 'SET_JOINTS',   // Set absolute joint angles { angles: [q1, q2, q3, q4, q5, q6] }

  // Pose / System
  HOME: 'HOME',               // Return to a known home pose
  STOP: 'STOP',               // Soft halt (pause motion, do not trip safety)
  HALT: 'HALT',               // Immediately stop all active motion and trip safety
  RESET_SAFETY: 'RESET_SAFETY',// Reset safety trip/error states

  // Autonomous / Automation Commands
  TAP_KEY: 'TAP_KEY',         // Perform hover-touch-retract on key { keyId }
  EXECUTE_PIN: 'EXECUTE_PIN', // Perform autonomous sequence on 6-digit PIN { pin }
  RUN_PIN: 'RUN_PIN'          // Same intent as EXECUTE_PIN with the newer pipeline-friendly name { pin }
};

// Helpful metadata for log rendering. Keeps StatusLog and tests consistent.
export const CommandMeta = {
  MOVE_EE:       { label: 'MOVE_EE',       short: 'EE Δ' },
  SET_EE:        { label: 'SET_EE',        short: 'EE →' },
  JOG_AXIS:      { label: 'JOG_AXIS',      short: 'EE axis' },
  MOVE_TO:       { label: 'MOVE_TO',       short: 'EE →' },
  JOG_JOINT:     { label: 'JOG_JOINT',     short: 'Joint Δ' },
  SET_JOINTS:    { label: 'SET_JOINTS',    short: 'Joints' },
  HOME:          { label: 'HOME',          short: 'Home' },
  STOP:          { label: 'STOP',          short: 'Stop' },
  HALT:          { label: 'HALT',          short: 'Halt' },
  RESET_SAFETY:  { label: 'RESET_SAFETY',  short: 'Reset' },
  TAP_KEY:       { label: 'TAP_KEY',       short: 'Tap' },
  EXECUTE_PIN:   { label: 'EXECUTE_PIN',   short: 'PIN' },
  RUN_PIN:       { label: 'RUN_PIN',       short: 'PIN' }
};
