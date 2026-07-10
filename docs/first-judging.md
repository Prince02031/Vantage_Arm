Use this for the **first judging**.

````md
# Vantage_Arm — First Judging Plan & Pitch

## 30-Second Pitch

Vantage_Arm is a browser-based simulation and control suite for Vantage’s 6-DOF industrial robotic arm. The goal is to let engineers safely test robotic control software before it ever touches real hardware.

Our system will load the provided URDF arm, render the 6-key test panel from the given coordinate config, and route every control method — dashboard, joystick, keyboard, voice, and autonomous PIN entry — through one shared safety-checked motion pipeline.

We have completed Phase A: the project structure, agent coordination rules, command contracts, safety validation contracts, motion pipeline skeleton, robot state store, trajectory runner skeleton, IK placeholders, and PIN planning interfaces. Now the team is splitting into parallel implementation tracks.

---

## Problem Understanding

The problem asks us to build a web app that can visualize, manually control, voice-control, and autonomously operate a 6-DOF robotic arm entirely in-browser, with no real hardware. The arm has a fixed stylus tip, and it must press keys on a known 6-key panel using coordinates from `key.config.json`. :contentReference[oaicite:0]{index=0}

The key scoring areas are:
- Visualization and dashboard
- Inverse kinematics
- Joystick and keyboard control
- Voice control
- Autonomous PIN entry
- Electrical schematic
- System architecture explanation :contentReference[oaicite:1]{index=1}

Our highest priority is autonomous PIN entry, because it carries the highest individual weight.

---

## Our Architecture

```text
Input Methods
Dashboard / Joystick / Keyboard / Voice / PIN
        ↓
Structured Command
        ↓
Safety Validator
        ↓
IK Solver
        ↓
Trajectory Runner
        ↓
URDF Robot Adapter
        ↓
3D Scene + Dashboard + Logs
````

The most important design decision is that we are not building separate controllers.

Everything calls:

```js
executeCommand(command)
```

This means joystick, keyboard, voice, typed commands, and autonomous PIN entry all reuse the same validated motion pipeline.

---

## Current Progress: Phase A Completed

We have completed the foundation layer:

```text
[✓] Project structure created
[✓] AGENTS.md created
[✓] Role documents for all 3 members created
[✓] Integration checkpoint document created
[✓] Shared command contract planned
[✓] Robot state store planned
[✓] Safety validator contract planned
[✓] Motion pipeline skeleton planned
[✓] Trajectory runner skeleton planned
[✓] IK placeholder contract planned
[✓] PIN runner contract planned
```

This lets all three members work in parallel without creating duplicate movement logic.

---

## Team Division

## Person 1 — URDF and Visualization

Responsibilities:

* Load the provided URDF arm in Three.js
* Discover movable joints and limits
* Render the robotic arm
* Render the 6-key panel from `key.config.json`
* Show joint angles and stylus position
* Expose a robot adapter for the motion pipeline

Expected output:

* Arm visible in browser
* Key panel visible
* Joint data visible
* Robot adapter connected

---

## Person 2 — Motion Pipeline, IK, Safety, PIN

Responsibilities:

* Own the central `executeCommand()` pipeline
* Implement deterministic safety validation
* Implement IK solver
* Implement smooth trajectory runner
* Implement `pressKey()`
* Implement autonomous `runPin()`

Expected output:

* Target movement works
* Key press sequence works
* PIN `123456` executes approach-touch-retreat for each key
* Success tolerance is logged

---

## Person 3 — Controls, Voice, Circuit, Docs

Responsibilities:

* Build joystick controls
* Build keyboard controls
* Build deterministic voice command parser
* Build typed command fallback
* Prepare Wokwi electrical schematic
* Prepare architecture diagram
* Prepare README and demo script

Expected output:

* Joystick calls `executeCommand()`
* Keyboard calls `executeCommand()`
* Voice/typed commands call `executeCommand()`
* Circuit and documentation ready

---

## Key Panel Strategy

The panel is loaded from `key.config.json`.

The file defines:

* frame: `base_link`
* units: meters
* approach axis: `-z`
* keys 1–6 with fixed 3D coordinates 

For every key press, we use:

```text
1. Approach above key: z + 0.05
2. Touch key coordinate
3. Retreat back upward: z + 0.05
```

A press is successful if the stylus tip reaches within `0.005m` of the key coordinate.

---

## Implementation Timeline From Now

## Next 2 Hours

Person 1:

* Load URDF
* Render arm
* Render key panel
* Inspect joints

Person 2:

* Complete safety validator
* Complete motion pipeline
* Start IK connection

Person 3:

* Build dashboard shell
* Build joystick and keyboard UI
* Start circuit notes

## Middle Sprint

Main goal:

* Make the arm move to one target coordinate
* Make `pressKey("5")` work
* Show logs and distance-to-target

## Core Sprint

Main goal:

* Implement autonomous PIN entry
* Validate PIN format
* Press all six keys in order
* Show progress and success/failure

## Final Sprint

Main goal:

* Add voice control
* Add typed fallback
* Finish circuit diagram
* Finish architecture diagram
* Polish UI
* Prepare final demo

---

## Safety Plan

Every command must pass deterministic validation before execution.

We validate:

* command type
* numeric targets
* workspace bounds
* valid key number
* valid PIN format
* joint limits
* IK success/failure
* stop command interruption

For optional agentic/LLM control, the LLM will only create structured commands. It will never move the arm directly. The problem statement explicitly requires agentic commands to pass deterministic validation before execution. 

---

## Final Demo Plan

Our final demo will show:

```text
1. URDF arm loaded in browser
2. 6-key panel rendered from config
3. Live joint angles and stylus position
4. Joystick movement
5. Keyboard movement
6. Voice or typed command: "press key five"
7. Autonomous PIN: 123456
8. Key press success logs
9. Architecture diagram
10. Electrical schematic
```

---

## Closing Statement

Our main engineering focus is trust and safety. Vantage_Arm is designed so that every input method goes through the same structured command format, deterministic validation, IK solving, and trajectory execution. This makes the simulation reliable enough to test robotic control software before moving anywhere near real hardware.

```
```
