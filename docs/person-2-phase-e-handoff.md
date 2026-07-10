# Phase E Voice Control Core (Deterministic Parser) - Person 2 Handoff

## Goal
Implement a highly robust, deterministic command parser that interprets natural text/voice phrases and translates them into structured pipeline commands, without bypassing `executeCommand`.

## Implementation Details

### 1. `parseVoiceCommand(input, context)`
Located in `src/controls/voiceCommandParser.js`.
- **Normalization:** Automatically trims whitespace, lowers case, removes duplicate spaces, and converts word-numbers (e.g. "one", "two") into digits (e.g. "1", "2").
- **Return Type:** `{ ok: boolean, message: string, command?: object, transcript: string, confidence: number }`.
- **Safety:** Unrecognized commands (or unsafe phrases like "press key nine" or "enter pin 120456") return `ok: false` with a descriptive message and do *not* generate a command object.

### 2. Supported Phrases
The parser explicitly supports and maps the following expressions to structured motion pipeline commands:
- **Move (Jog):** `move up`, `move down`, `move forward`, `move backward`, `move left`, `move right` -> Maps to `JOG` commands with 0.02m deltas.
- **System:** `home`, `stop`, `halt`, `emergency stop`, `reset safety`.
- **Key Press:** `press key 5`, `tap key 5`, `press key five` -> Maps to `PRESS_KEY` (`key: '5'`). Only keys 1-6 are accepted.
- **Autonomous PIN:** `enter pin 123456`, `enter pin one two three four five six` -> Maps to `RUN_PIN`. Only exactly 6 digits (1-6) are accepted.
- **Rotate Base:** `rotate base 30 degrees`, `rotate base minus 30 degrees`, `rotate base left 30 degrees`, `rotate base right 30 degrees` -> Maps to `ROTATE_JOINT`. Base joint name is inferred dynamically from the `robotAdapter.getMovableJoints()` context.

### 3. `parseAndExecuteVoiceCommand(input, executeCommand, context)`
A helper function that handles both parsing the input and dispatching it to the motion pipeline in one shot. It returns a comprehensive execution summary that can be fed directly back to the UI.

### 4. Known Limitations & Assumptions
- **Base Joint Assumption:** The parser assumes the first movable joint returned by the adapter is the "base" joint for the rotate command, unless explicitly provided via `context.baseJointName`.
- **Strict Matching:** The regexes require somewhat exact phrasing. "move up 5 cm" is no longer parsed by this strict subset (though it was in previous phases). This strictness ensures zero ambiguity before we introduce the LLM in the next phase.

## Ready for Phase 3 (LLM / Agentic Voice)
The deterministic parser establishes a secure boundary. When the LLM is added, its output can be fed through this parser or the command structures to ensure it never violates formatting constraints.
