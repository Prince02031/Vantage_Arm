import { getRobotAdapter } from '../core/robotStore.js';

const NUMBER_WORDS = {
  zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5', six: '6',
  seven: '7', eight: '8', nine: '9'
};

/**
 * Normalizes transcript by converting word numbers to digits, lowercasing, and trimming.
 */
function normalizeText(text) {
  let normalized = (text || '').toLowerCase().trim();
  // Remove trailing punctuation (periods, question marks, exclamation marks, commas)
  normalized = normalized.replace(/[.,?!]+$/, '').trim();
  // Normalize degree symbol to the word
  normalized = normalized.replace(/°/g, ' degrees');
  // Remove extra spaces
  normalized = normalized.replace(/\s+/g, ' ');
  // Replace digit words with digits
  for (const [word, digit] of Object.entries(NUMBER_WORDS)) {
    const regex = new RegExp(`\\b${word}\\b`, 'g');
    normalized = normalized.replace(regex, digit);
  }
  return normalized;
}

/**
 * Parses a single deterministic voice command transcript into a pipeline command.
 */
export function parseVoiceCommand(input, context = {}) {
  const source = context.source || 'voice';
  const confidence = context.confidence || 1.0;
  const transcript = normalizeText(input);

  if (!transcript) {
    return { ok: false, message: 'Empty transcript.', transcript, confidence };
  }

  // --- 1. Basic Movement (move up/down/forward/backward/left/right) ---
  const moveMatch = transcript.match(/^move\s+(up|down|forward|backward|left|right)$/);
  if (moveMatch) {
    const dir = moveMatch[1];
    let axis, delta;
    switch (dir) {
      case 'up': axis = 'z'; delta = 0.02; break;
      case 'down': axis = 'z'; delta = -0.02; break;
      case 'forward': axis = 'x'; delta = 0.02; break;
      case 'backward': axis = 'x'; delta = -0.02; break;
      case 'left': axis = 'y'; delta = 0.02; break;
      case 'right': axis = 'y'; delta = -0.02; break;
    }
    return {
      ok: true,
      message: `Parsed move ${dir}.`,
      command: { type: 'jog', axis, delta, source },
      transcript,
      confidence
    };
  }

  // --- 2. System Commands (home, stop) ---
  if (transcript === 'home') {
    return { ok: true, message: 'Parsed home.', command: { type: 'home', source }, transcript, confidence };
  }
  if (transcript === 'stop' || transcript === 'halt' || transcript === 'emergency stop') {
    return { ok: true, message: 'Parsed stop.', command: { type: 'stop', source }, transcript, confidence };
  }
  if (transcript === 'reset safety') {
    return { ok: true, message: 'Parsed reset safety.', command: { type: 'resetSafety', source }, transcript, confidence };
  }

  // --- 3. Press Key ---
  // e.g. "press key 5", "press key five" -> "press key 5" due to normalization
  const pressKeyMatch = transcript.match(/^(?:press|tap)\s+key\s+(\d+)$/);
  if (pressKeyMatch) {
    const key = pressKeyMatch[1];
    if (/^[1-6]$/.test(key)) {
      return { ok: true, message: `Parsed press key ${key}.`, command: { type: 'pressKey', key, source }, transcript, confidence };
    } else {
      return { ok: false, message: `Invalid key "${key}". Only keys 1-6 are supported.`, transcript, confidence };
    }
  }

  // --- 4. Enter PIN ---
  // e.g. "enter pin 123456", "enter pin 1 2 3 4 5 6"
  const pinMatch = transcript.match(/^enter\s+pin\s+(.+)$/);
  if (pinMatch) {
    const rawPin = pinMatch[1].replace(/\s+/g, ''); // remove spaces inside pin
    if (/^[1-6]{6}$/.test(rawPin)) {
      return { ok: true, message: `Parsed enter pin ${rawPin}.`, command: { type: 'runPin', pin: rawPin, source }, transcript, confidence };
    } else {
      return { ok: false, message: `Invalid PIN format. Must be exactly 6 digits (1-6).`, transcript, confidence };
    }
  }

  // --- 5. Rotate Base ---
  // e.g. "rotate base 30 degrees", "rotate base minus 30 degrees", "rotate base left 30 degrees"
  const rotateBaseMatch = transcript.match(/^rotate\s+base\s+(minus\s+|left\s+|right\s+)?([\d.]+)\s*(?:degrees|degree|deg|degs|°)?$/);
  if (rotateBaseMatch) {
    const modifier = (rotateBaseMatch[1] || '').trim();
    const val = parseFloat(rotateBaseMatch[2]);
    let deltaDeg = val;
    
    // "minus" or "right" means negative rotation for base usually, assuming standard convention
    if (modifier === 'minus' || modifier === 'right') {
      deltaDeg = -val;
    }
    // "left" can mean positive
    if (modifier === 'left') {
      deltaDeg = Math.abs(val);
    }

    let baseJointName = context.baseJointName;
    const adapter = context.robotAdapter || getRobotAdapter();
    if (!baseJointName && adapter) {
      const joints = adapter.getMovableJoints() || [];
      if (joints.length > 0) {
        baseJointName = typeof joints[0] === 'string' ? joints[0] : joints[0].name;
      }
    }

    if (!baseJointName) {
      return { ok: false, message: 'Base joint unavailable.', transcript, confidence };
    }

    return { 
      ok: true, 
      message: `Parsed rotate base ${deltaDeg} degrees.`, 
      command: { type: 'rotateJoint', jointName: baseJointName, deltaDeg, source }, 
      transcript, 
      confidence 
    };
  }

  // Unrecognized or unsafe
  return { ok: false, message: `Unrecognized or unsupported command: "${transcript}"`, transcript, confidence };
}

/**
 * Parses and executes a voice command.
 * 
 * @param {string} input - Voice transcript
 * @param {Function} executeCommand - The motion pipeline entrypoint
 * @param {Object} context - Optional context (robotAdapter, baseJointName, source)
 * @returns {Promise<Object>} Execution summary
 */
export async function parseAndExecuteVoiceCommand(input, executeCommand, context = {}) {
  const parseResult = parseVoiceCommand(input, context);

  if (!parseResult.ok) {
    return { ok: false, message: parseResult.message, parseResult };
  }

  // Execute a single command
  if (parseResult.command) {
    const execResult = await executeCommand(parseResult.command, context);
    return { ok: execResult.ok, message: execResult.message, parseResult, execution: execResult };
  }

  // Execute multiple sequential commands if parser generated them
  if (parseResult.commands && Array.isArray(parseResult.commands)) {
    const results = [];
    for (const cmd of parseResult.commands) {
      const res = await executeCommand(cmd, context);
      results.push(res);
      if (!res.ok) {
        return { ok: false, message: `Sequential execution failed: ${res.message}`, parseResult, executionResults: results };
      }
    }
    return { ok: true, message: 'All sequential commands executed successfully.', parseResult, executionResults: results };
  }

  return { ok: false, message: 'No command generated by parser.', parseResult };
}
