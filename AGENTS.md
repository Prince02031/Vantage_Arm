# AGENTS.md — Vantage_Arm

## Project Name
Vantage_Arm

## Project Goal
Build a browser-based 6-DOF robotic arm simulation and control suite.

---

## Core Architecture Rule

There must be exactly one shared motion-control pipeline.
All input methods must produce structured commands and call the single entrypoint:

```js
executeCommand(command)
```

### Shared Flow Pipeline:
1. **Input Method** (e.g., Sliders, Joystick, Keyboard, Voice)
2. $\to$ **Structured Command** (conforming to schema in `commandTypes.js`)
3. $\to$ **`executeCommand(command)`** (central entry point in `motionPipeline.js`)
4. $\to$ **`safetyValidator`** (validates joint limits, collision checks, workspace limits)
5. $\to$ **`IK Solver / Joint Resolver`** (translates Cartesian targets to joint states)
6. $\to$ **`trajectoryRunner`** (smoothly interpolates steps over time)
7. $\to$ **`Robot Adapter`** (updates joint positions on the 3D model)
8. $\to$ **`UI State Update`** (reactively feeds back joint and EE values to state store)
9. $\to$ **`Status Log`** (logs results, successes, or safety violations)

---

## Supported Movement Sources
All triggers must resolve to structured commands dispatched to the motion pipeline:
- **Dashboard Target Input**: Slider inputs for Cartesian target $(x,y,z)$ and Joint angles.
- **GUI Joystick**: On-screen dynamic joystick for jogging end-effector step increments.
- **Keyboard**: Arrow keys / WASD + Shift/Ctrl modifiers for jogging.
- **Deterministic Voice Commands**: Keyword speech recognition (e.g., `"move left 10 cm"`).
- **Typed Command Fallback**: Direct console or text entry for debugging voice commands.
- **Autonomous PIN Entry**: Full autonomous tapping routine sequence for a 6-digit PIN.
- **Optional Agentic Voice Layer**: LLM/Gemini reasoning layer that translates free-form expressions into the exact same command types.

---

## Mandated Engineering Rules

All agents must strictly follow these rules without exception:

1. **No Duplicate Pipelines**: Do not create parallel or secondary motion controllers or coordinate writers. Everything must flow through `executeCommand`.
2. **No Direct Model Updates**: Do not move the robot's joint positions directly from UI slider events, keyboard triggers, or voice handlers. The UI reads state; only the motion pipeline writes to it.
3. **No Safety Bypass**: Every command must go through `safetyValidator.js`. An validation rejection must halt movement and log the safety error.
4. **No Hardcoded Key Coordinates**: Do not hardcode button positions in the 3D scene or PIN runner.
5. **Load Key Data Dynamically**: Read the coordinates of the 6-key panel dynamically from `public/config/key.config.json`.
6. **No Speculative Joint Names**: Do not hardcode joint or link name strings in the kinematics engines until the URDF has been inspected and parsed.
7. **PIN Format**: The PIN sequence must accept exactly a six-digit string comprised only of digits `1` to `6`.
8. **No Ungated LLM Commands**: Commands parsed by the LLM/Agentic reasoning layer must be treated as untrusted inputs and pass through `safetyValidator.js` before execution.
9. **No Database**: Maintain all state in memory. No server-side databases (SQLite, MongoDB, etc.).
10. **No Authentication**: The application is an industrial engineering workspace simulation; do not build user login/authentication flows.
11. **No Real Hardware Control**: The system is a simulation; do not attempt connection to physical microcontrollers over HTTP or WebSockets.
12. **Build Validation**: Always run `npm run build` locally to verify bundling success before declaring task completion.