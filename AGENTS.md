# AGENTS.md — Vantage_Arm

## Project Name

Vantage_Arm

## Project Goal

Build a browser-based 6-DOF robotic arm simulation and control suite.

The app must:
- Load and render the provided URDF arm.
- Render the 6-key test panel from `key.config.json`.
- Show live joint angles and end-effector position.
- Move the stylus tip using inverse kinematics.
- Support dashboard/manual movement.
- Support GUI joystick movement.
- Support keyboard movement.
- Support deterministic voice commands.
- Support autonomous 6-digit PIN entry.
- Include an electrical schematic / Wokwi proof-of-concept.
- Include architecture and motion-pipeline documentation.

## Most Important Architecture Rule

There must be exactly one shared motion-control pipeline.

All movement sources must call:

```js
executeCommand(command)