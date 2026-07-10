# Vantage Arm: Final Round Technical Analysis & Architecture Blueprint

This document details the engineering requirements, architectural design, safety boundaries, kinematics approach, and hardware planning for the **Vantage_Arm** 6-DOF robotic arm simulation project, derived from the hackathon problem statement and rulebook.

---

## 1. Core Objectives & Scope

The goal is to build a browser-based 3D simulator for a 6-DOF industrial robotic arm equipped with a stylus tip (no gripper). The simulation serves to validate control software in a safe, browser-based environment before deploying it to physical hardware.

### Key Phases:
1. **Phase 1: Visualization & Dashboard**: Render the URDF robot arm and the 6-key test panel (based on `key.config.json`) in a WebGL-based 3D scene (Three.js). Display live joint angles and end-effector coordinates.
2. **Phase 2: Kinematics & Manual Control**: Implement Forward Kinematics (FK) and Inverse Kinematics (IK). Provide multiple manual control options (UI sliders/dashboard, GUI joystick, and WASD/arrow keyboard jogging).
3. **Phase 3: Voice Control (Deterministic & Agentic)**: Parse spoken/typed commands.
   - *Deterministic*: Keyword-based mapping (e.g., "move up", "rotate base 30 degrees").
   - *Agentic (Bonus)*: LLM/Gemini reasoning layer for free-form instructions (e.g., "nudge the tip a couple centimeters toward the panel and tap the 5 key twice"), returning natural language confirmation/clarification.
4. **Phase 4: Autonomous PIN Entry**: Execute a sequence of keypresses (downward touch/retract motion) based on a 6-digit PIN. Verify reach/touch accuracy within a $\pm$5mm tolerance.
5. **Phase 5: Electrical Schematic**: Draft a proof-of-concept Wi-Fi controlled servo driver circuit.

---

## 2. Most Important Architecture Rule: Unified Motion Pipeline

To maintain architectural integrity and prevent unsanctioned or unsafe motion commands, **all movement sources must route through a single, shared motion control pipeline**.

```
   [Manual Sliders] -------\
   [GUI Joystick] ----------+---> [executeCommand(command)]
   [Keyboard Jogging] -----/               |
   [Deterministic Voice] --/               v
   [Agentic Voice (LLM)] ----> [Safety Gate] --(Approved)--> [Safety Validator]
                                                                   |
   [Autonomous PIN Entry] -----------------------------------------/
                                                                   |
                                                                   v
                                                        (Reachability & Limits)
                                                                   |
                                                                   +--(Valid)--> [Motion Pipeline]
                                                                                       |
                                                                                       v
                                                                             [Trajectory Runner]
                                                                                       |
                                                                                       v
                                                                              [ThreeScene Render]
```

### Motion Pipeline Contract
Every input mechanism must formulate a standardized command structure and call the global `executeCommand(command)` function:
- **`command.type`**: E.g., `MOVE_EE` (Cartesian end-effector step), `SET_EE` (Absolute Cartesian coordinate), `JOG_JOINT` (Step joint angle), `SET_JOINTS` (Absolute joint angles), `TAP_KEY` (Autonomous tap).
- **`command.payload`**: Parameters (coordinates, offsets, joint indices, or angles).
- **`command.source`**: Identity of trigger (e.g., `'keyboard'`, `'joystick'`, `'voice'`, `'autonomous'`).

---

## 3. Kinematics Strategy (FK / IK)

The arm is a 6-DOF manipulator. 

### 1. Forward Kinematics (FK)
- **Purpose**: Calculate the 3D position and orientation of the stylus tip given the current 6 joint angles ($\theta_1, \theta_2, \dots, \theta_6$).
- **Method**: Traverse the URDF tree structure, calculating the transformation matrix of each link relative to its parent using joint axes and offsets:
  $$T_{\text{end\_effector}}^{\text{base}} = T_1^0(\theta_1) \cdot T_2^1(\theta_2) \dots T_6^5(\theta_6) \cdot T_{\text{stylus}}^6$$
- **Implementation**: Leverage the URDF model hierarchy. When joints are rotated, the end-effector's coordinate is retrieved from the child bone's world transform matrix.

### 2. Inverse Kinematics (IK)
- **Purpose**: Calculate the required joint angles ($\theta_1, \dots, \theta_6$) to place the stylus tip at a target $(x, y, z)$.
- **Method**: 
  - **Analytical approach**: Can be mathematically complex for a general 6-DOF arm if the wrist axes do not intersect at a single point (spherical wrist).
  - **Numerical approach (Jacobian Transpose / Damped Least Squares / Cyclic Coordinate Descent)**: More robust for generic URDFs in a browser environment.
  - **Optimization**: Use an iterative Jacobian solver or CCD (Cyclic Coordinate Descent) implemented in JavaScript (`ikSolver.js`) to find a valid joint configuration that minimizes the distance error between the end-effector and the target position.
  - **Constraints**: Enforce joint rotation limits directly in the solver loop.

---

## 4. Safety & Validation Pipeline

Before any joint angle updates are committed to the `robotStore.js`, the proposed movement must pass through `safetyValidator.js`.

### Validation Criteria:
1. **Joint Angle Limits**: For each joint $i$, verify $\theta_{i,\min} \le \theta_i \le \theta_{i,\max}$ based on the limits defined in the URDF.
2. **Workspace Bounds**: Ensure the target end-effector position $(x, y, z)$ lies within a safe bounding sphere/box around the arm base, protecting against singularities and unreachable targets.
3. **Collision Avoidance (Table/Fixture)**: Prevent the arm from colliding with the floor ($z < 0$) or colliding with the key panel fixture except during intentional downward touch actions.
4. **Velocity/Acceleration Limits**: Interpolate sudden target changes over time to prevent unrealistic joint snaps (implemented in `trajectoryRunner.js`).

---

## 5. Autonomous PIN-Entry Execution (Phase 4)

Given a 6-digit PIN, the `pinRunner.js` orchestrates a sequence of joint trajectories to press the buttons.

### Key coordinates (from `key.config.json`):
- All keys are defined in the `base_link` frame in meters.
- Key grid spacing is $50\text{ mm}$ along $x$ and $100\text{ mm}$ along $y$.
- Height of keys is $z = 0.050\text{ m}$.
- Approach axis is $-z$, meaning the arm must descend downward onto the key.

### Touch Execution Routine:
```
                       (1) Hover Position (z = 0.080m)
                              o-------> [Move to Next Key]
                             / \
       (2) Downward Touch   /   \   (3) Retract
                           v     \
                          [Key]   o
                      (z = 0.050m)
```
1. **Read Target Coordinate**: Lookup $(x_{\text{key}}, y_{\text{key}}, z_{\text{key}})$ from config.
2. **Move to Hover Position**: Position the stylus tip at $(x_{\text{key}}, y_{\text{key}}, z_{\text{key}} + 30\text{mm})$ to avoid grazing other keys.
3. **Downward Touch**: Linear interpolation downward to $(x_{\text{key}}, y_{\text{key}}, z_{\text{key}})$.
4. **Reach Verification**: Check if the physical simulated tip coordinate matches the target within $\pm 5\text{mm}$.
5. **Retract**: Return to hover height.
6. **Next Digit**: Repeat for all 6 digits.

---

## 6. Voice and Agentic Control Pipeline

The voice control consists of two distinct modules to satisfy both deterministic and advanced NLP specifications.

### 1. Deterministic Voice Parser (`voiceCommandParser.js`)
- Uses Web Speech API (`webkitSpeechRecognition`) for local browser speech-to-text.
- Employs strict regex mapping to extract action values:
  - `"move (up|down|left|right|forward|back) [by] {X} (centimeters|inches|meters)"`
  - `"rotate (base|shoulder|elbow|wrist) [by] {Y} degrees"`
- Maps matching speech strings directly to specific command payloads.

### 2. Agentic Parser (`agenticCommandParser.js` - Phase 3B Bonus)
- Routes unstructured text/transcript to a reasoning layer (such as the Gemini API or a mock backend proxy if key is unavailable).
- **Prompt Instruction**: Force the LLM to output a JSON array of structured motion commands that conform to the motion pipeline schema.
- **Ambiguity Handling**: If the instruction is vague (e.g., "nudge the arm a bit"), the parser flags it as ambiguous and queries the user for clarification rather than executing speculative movements.
- **Safety Gate**: Re-emphasizing that LLM outputs **never** bypass `safetyValidator.js`. If the LLM generates an out-of-bounds coordinate, the command is aborted, and a natural language explanation is spoken back to the user.

---

## 7. Electrical & Hardware Design (Phase 5)

A physical implementation of the Vantage Arm requires a robust Wi-Fi enabled controller driving 6 high-torque servo motors.

### Key Hardware Selection:
- **Microcontroller**: ESP32 (built-in Wi-Fi, hardware timers for PWM).
- **Servo Drivers**: PCA9685 16-channel 12-bit I2C PWM driver (offloads PWM generation from the ESP32 and provides clean 5V power routing).
- **Actuators**: 
  - Joint 1–3: High-torque digital servos (e.g., RDS3218 or TD-8120MG, 20kg-cm).
  - Joint 4–6: Standard metal-gear micro servos (e.g., MG996R or MG90S, depending on load).
- **Power Delivery**: External 5V/10A DC switching power supply (servos must never draw current directly from the ESP32 pins to avoid brownouts).

### Connection Pin-Mapping:

| Controller (ESP32) | Driver (PCA9685) | Description |
|---|---|---|
| `3.3V` | `VCC` | Logic Power |
| `GND` | `GND` | Common Logic Ground |
| `GPIO 21` (SDA) | `SDA` | I2C Data Line |
| `GPIO 22` (SCL) | `SCL` | I2C Clock Line |
| - | `V+` (Screw Terminal) | External 5V–6V Power (Servos) |

| PCA9685 Channel | Servo Motor | Joint Description |
|---|---|---|
| `Channel 0` | Servo 1 | Joint 1 (Base Rotation) |
| `Channel 1` | Servo 2 | Joint 2 (Shoulder Pitch) |
| `Channel 2` | Servo 3 | Joint 3 (Elbow Pitch) |
| `Channel 3` | Servo 4 | Joint 4 (Wrist Roll) |
| `Channel 4` | Servo 5 | Joint 5 (Wrist Pitch) |
| `Channel 5` | Servo 6 | Joint 6 (Wrist Yaw) |

---

## 8. Validation Plan & Edge Cases

Our testing protocol in the simulator must address key edge cases:
- **Singularities**: Arm configurations where mathematical degrees of freedom are lost (e.g., arm fully extended straight up). The IK solver must handle divide-by-zero errors gracefully.
- **URDF Load Failures**: Handling visual fallback if the URDF parser fails to load the file at runtime.
- **Voice Noise**: Filtering out environment chatter so voice command routines are not triggered accidentally.
- **PIN unreachable**: Throwing a clear safety exception if a key coord falls out of range for the current arm base mounting.
- **Required Dummy Data**: Whenever displaying operator logins or default profiles, the app must exclusively display:
  - Nafisa Rahman (nafisa.rahman@yahoo.com, +8801812345678)
  - Tanvir Hossain (tanvir.hossain@yahoo.com, +8801912345678)
