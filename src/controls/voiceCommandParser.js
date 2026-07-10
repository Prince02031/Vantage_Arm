// src/controls/voiceCommandParser.js
// Phase C: emit pipeline-native command types (pressKey, jog, moveTo, runPin, home, stop)
// normalizeCommand() in commandTypes.js also maps aliases, but we use canonical types here
// for clarity and to avoid double-aliasing bugs.
import { CommandTypes } from '../core/commandTypes.js';

/**
 * Deterministic voice command parser.
 *
 * Accepts a free-text transcript (e.g. "move up by 5 cm") and produces a single
 * `command` object suitable for `executeCommand(command)`. The parser uses
 * strict keyword regex matching — no LLM calls in this module.
 *
 * Supported phrases (case-insensitive):
 *
 *   Phase B wired-controls (per Person 3 spec):
 *     - move (up|down|left|right|forward|back)              → JOG_AXIS delta 2cm
 *     - press key (one|two|three|four|five|six|<N> 1-6)     → TAP_KEY
 *     - enter pin <NNNNNN>                                  → RUN_PIN
 *     - home                                                → HOME
 *     - stop                                                → STOP
 *
 *   Extended phrases still supported:
 *     - move <dir> [by] <N> (cm|in|m)                       → MOVE_EE dx/dy/dz
 *     - rotate (base|shoulder|elbow|wrist) [by] <N> deg     → JOG_JOINT
 *     - tap key <N>                                         → TAP_KEY
 *     - halt / emergency stop                               → HALT
 *     - reset safety                                        → RESET_SAFETY
 *
 * Returns `{ matched: boolean, command?: object, message: string }`.
 */
const NUMBER = '(-?\\d+(?:\\.\\d+)?)';

// Direction → axis sign for the bare "move up/down/left/right/forward/back"
// phrase (no magnitude). Step size matches the joystick default 0.02m.
const DIRECTION_AXIS = {
  up:      { axis: 'z', sign: +1 },
  down:    { axis: 'z', sign: -1 },
  left:    { axis: 'x', sign: -1 },
  right:   { axis: 'x', sign: +1 },
  forward: { axis: 'y', sign: +1 },
  back:    { axis: 'y', sign: -1 }
};

// Word-to-digit map for the bare "press key one" phrase variants.
const NUMBER_WORDS = {
  one: '1', two: '2', three: '3', four: '4', five: '5', six: '6'
};

// Old-style "move <dir> by <N> cm" → meters per 1cm unit.
const DIRECTIONS = {
  up:      { dx: 0, dy: 0, dz:  0.01, unit: 'cm' },
  down:    { dx: 0, dy: 0, dz: -0.01, unit: 'cm' },
  left:    { dx: -0.01, dy: 0, dz: 0,  unit: 'cm' },
  right:   { dx:  0.01, dy: 0, dz: 0,  unit: 'cm' },
  forward: { dx: 0, dy:  0.01, dz: 0,  unit: 'cm' },
  back:    { dx: 0, dy: -0.01, dz: 0,  unit: 'cm' }
};

// rotate <part> <N> degrees
const RE_ROTATE = new RegExp(
  `^\\s*rotate\\s+(base|shoulder|elbow|wrist(?:\\s*\\d)?)[\\s\\w]*${NUMBER}\\s*(?:degrees|deg)?\\s*$`,
  'i'
);
const JOINT_FOR_PART = {
  base: 0,
  shoulder: 1,
  elbow: 2,
  wrist: 4
};

// "move <dir> [by] <N> (cm|in|m)" — old shape with magnitude.
const RE_MOVE = new RegExp(
  `^\\s*move\\s+(up|down|left|right|forward|back)[\\s\\w]+${NUMBER}\\s*(centimeters|cm|inches|in|meters|m)?\\s*$`,
  'i'
);

// tap key <N> (1..6) and press key <one|two|three|four|five|six|N>
const RE_TAP_KEY_NUM  = /^\s*tap\s+key\s+([1-6])\s*$/i;
const RE_PRESS_KEY_N  = /^\s*press\s+key\s+([1-6])\s*$/i;
const RE_PRESS_KEY_W  = /^\s*press\s+key\s+(one|two|three|four|five|six)\s*$/i;

// "move to X Y Z" — absolute Cartesian target
const RE_MOVE_TO = new RegExp(
  `^\\s*move\\s+to\\s+${NUMBER}\\s+${NUMBER}\\s+${NUMBER}\\s*$`,
  'i'
);

// enter pin <NNNNNN>
const RE_PIN = /^\s*enter\s+pin\s+(\d{6})\s*$/i;

const UNITS_TO_METERS = {
  cm: 0.01,
  centimeters: 0.01,
  in: 0.0254,
  inches: 0.0254,
  m: 1.0,
  meters: 1.0
};

export function parseVoiceCommand(transcript, { source = 'voice' } = {}) {
  if (!transcript || typeof transcript !== 'string') {
    return { matched: false, message: 'Empty voice transcript.' };
  }
  const text = transcript.trim();

  // --- Phase C "move to X Y Z" absolute target phrase ---
  const moveToMatch = text.match(RE_MOVE_TO);
  if (moveToMatch) {
    const x = parseFloat(moveToMatch[1]);
    const y = parseFloat(moveToMatch[2]);
    const z = parseFloat(moveToMatch[3]);
    if (Number.isFinite(x) && Number.isFinite(y) && Number.isFinite(z)) {
      return {
        matched: true,
        message: `Move to (${x}, ${y}, ${z}) m`,
        command: { type: 'moveTo', target: { x, y, z }, source }
      };
    }
  }

  // --- Phase B bare-direction phrases (no magnitude). -----------------------
  // "move up" → jog z +2cm
  const bareMove = text.match(/^\s*move\s+(up|down|left|right|forward|back)\s*$/i);
  if (bareMove) {
    const dir = bareMove[1].toLowerCase();
    const { axis, sign } = DIRECTION_AXIS[dir];
    return {
      matched: true,
      message: `Move ${dir} → ${axis.toUpperCase()}${sign > 0 ? '+' : '−'} (2 cm)`,
      command: { type: 'jog', axis, delta: sign * 0.02, source }
    };
  }

  // --- System commands (Phase B short forms) ---
  if (/^\s*home\s*$/i.test(text)) {
    return {
      matched: true,
      message: 'Recognized home from voice.',
      command: { type: CommandTypes.HOME, payload: {}, source }
    };
  }
  if (/^\s*stop\s*$/i.test(text)) {
    return {
      matched: true,
      message: 'Recognized stop from voice.',
      command: { type: CommandTypes.STOP, payload: {}, source }
    };
  }

  // --- Emergency halt (trips safety) ---
  if (/^\s*(halt|emergency\s+stop)\s*$/i.test(text)) {
    return {
      matched: true,
      message: `Recognized halt from voice: "${text}"`,
      command: { type: CommandTypes.HALT, payload: {}, source }
    };
  }
  if (/^\s*reset\s+safety\s*$/i.test(text)) {
    return {
      matched: true,
      message: `Recognized safety reset from voice: "${text}"`,
      command: { type: CommandTypes.RESET_SAFETY, payload: {}, source }
    };
  }

  // --- "press key one|two|three|four|five|six" (Phase C — emit pressKey) ---
  const pressWord = text.match(RE_PRESS_KEY_W);
  if (pressWord) {
    const key = NUMBER_WORDS[pressWord[1].toLowerCase()];
    return {
      matched: true,
      message: `Press key ${pressWord[1].toLowerCase()} (key ${key}) — full approach/touch/retreat.`,
      command: { type: 'pressKey', key, source }
    };
  }
  const pressNum = text.match(RE_PRESS_KEY_N);
  if (pressNum) {
    const key = pressNum[1];
    return {
      matched: true,
      message: `Press key ${key} — full approach/touch/retreat.`,
      command: { type: 'pressKey', key, source }
    };
  }

  // --- "enter pin NNNNNN" (Phase C) ---
  const pinMatch = text.match(RE_PIN);
  if (pinMatch) {
    const pin = pinMatch[1];
    const ok = /^[1-6]{6}$/.test(pin);
    return {
      matched: ok,
      message: ok
        ? `Enter PIN ${pin} from voice.`
        : `Enter PIN ${pin} from voice — digits must each be 1–6.`,
      command: ok
        ? { type: 'runPin', pin, source }
        : undefined
    };
  }

  // --- Tap key <N> (legacy alias → pressKey) ---
  const tapMatch = text.match(RE_TAP_KEY_NUM);
  if (tapMatch) {
    const key = tapMatch[1];
    return {
      matched: true,
      message: `Tap key ${key} → pressKey pipeline.`,
      command: { type: 'pressKey', key, source }
    };
  }

  // --- Rotate joint ---
  const rotateMatch = text.match(RE_ROTATE);
  if (rotateMatch) {
    const partRaw = rotateMatch[1].toLowerCase();
    const part = partRaw.replace(/\s*\d$/, ''); // "wrist 1" → "wrist"
    const degrees = parseFloat(rotateMatch[2]);
    const jointId = JOINT_FOR_PART[part];
    if (jointId === undefined) {
      return { matched: false, message: `Unknown joint part: "${partRaw}"` };
    }
    const delta = (degrees * Math.PI) / 180;
    return {
      matched: true,
      message: `Rotate ${part} by ${degrees}° → joint ${jointId + 1} (${delta.toFixed(3)} rad)`,
      command: { type: CommandTypes.JOG_JOINT, payload: { jointId, delta }, source }
    };
  }

  // --- Move EE with magnitude (legacy — maps to jog single axis) ---
  const moveMatch = text.match(RE_MOVE);
  if (moveMatch) {
    const dir = moveMatch[1].toLowerCase();
    const value = parseFloat(moveMatch[2]);
    const unit = (moveMatch[3] || 'cm').toLowerCase();
    const unitMeters = UNITS_TO_METERS[unit] ?? UNITS_TO_METERS.cm;
    const { axis, sign } = DIRECTION_AXIS[dir] || { axis: 'z', sign: 1 };
    const delta = sign * value * unitMeters;
    return {
      matched: true,
      message: `Move ${dir} by ${value} ${unit} → jog ${axis.toUpperCase()} ${delta > 0 ? '+' : ''}${delta.toFixed(3)}m`,
      command: { type: 'jog', axis, delta, source }
    };
  }

  return { matched: false, message: `Unrecognized voice command: "${text}"` };
}

