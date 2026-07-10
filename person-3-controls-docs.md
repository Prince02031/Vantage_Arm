```md
# Person 3 Role — Controls, Voice, Circuit, Docs, and Presentation

## Owner

Person 3

## Main Responsibility

Build the operator-facing controls and final presentation material for Vantage_Arm.

This person owns:
- GUI joystick
- keyboard controls
- deterministic voice command parser
- typed voice-command fallback
- optional agentic parser
- status log UI
- electrical schematic notes
- architecture diagram
- README
- demo script

## Files Owned

```text
src/controls/joystickCommands.js
src/controls/keyboardCommands.js
src/controls/voiceCommandParser.js
src/controls/agenticCommandParser.js

src/components/JoystickPanel.jsx
src/components/KeyboardHelp.jsx
src/components/VoicePanel.jsx
src/components/StatusLog.jsx
src/components/Dashboard.jsx

circuit/schematic-notes.md
circuit/pin-mapping.md
circuit/wokwi-link.md

diagrams/architecture.drawio
diagrams/motion-pipeline.drawio

README.md
docs/demo-script.md