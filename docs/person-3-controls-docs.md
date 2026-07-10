# Person 3 Role — UI, Manual Inputs, & Voice Control

## Main Responsibility
Build the user interface panels, manual controls (jogging sliders, virtual joystick, keyboard hooks), voice parsing modules, status logs console, and the optional agentic reasoning layer.

## Files Owned
- `src/controls/joystickCommands.js`
- `src/controls/keyboardCommands.js`
- `src/controls/voiceCommandParser.js`
- `src/controls/agenticCommandParser.js`
- `src/components/Dashboard.jsx`
- `src/components/JointPanel.jsx`
- `src/components/JoystickPanel.jsx`
- `src/components/KeyboardHelp.jsx`
- `src/components/VoicePanel.jsx`
- `src/components/SafetyPanel.jsx`
- `src/components/StatusLog.jsx`

---

## Technical Coordination Rules for Person 3

1. **Strict Command Routing**:
   - All interactive components (joystick, keyboard buttons, voice listeners) must dispatch actions through `executeCommand(command)`.
   - Never write direct coordinate increments or state assignments within input callbacks.
   - Example UI slider hook:
     ```js
     import { executeCommand } from '../core/motionPipeline.js';
     import { CommandTypes } from '../core/commandTypes.js';

     const handleSliderChange = (jointId, newAngle) => {
       executeCommand({
         type: CommandTypes.SET_JOINTS,
         payload: { angles: [/* ... */] },
         source: 'dashboard'
       });
     };
     ```

2. **Reading Command Contracts**:
   - Refer to `src/core/commandTypes.js` for allowed types (`MOVE_EE`, `SET_EE`, `JOG_JOINT`, `SET_JOINTS`, `TAP_KEY`, `EXECUTE_PIN`, `HALT`).
   - Do not invent custom types or pass non-conforming parameters.

3. **Status Log Integration**:
   - Bind the UI log table component to `robotStore.subscribe((state) => state.logs)` to display system messages, validation warnings, and coordinates.

4. **Agentic Voice Control (LLM integration)**:
   - When using the optional LLM parser, instruct the prompt to return an array of structured commands matching the `commandTypes.js` schema.
   - Do not pass commands directly to the joint states. All LLM-generated commands must be submitted via `executeCommand(command)` so they are validated by Person 2's `safetyValidator.js`.
