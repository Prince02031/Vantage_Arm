# Demo Script — Vantage Arm

A 3-minute walkthrough aligned with the current Phase B dashboard layout and
wired-up manual controls.

## Setup

1. `npm install`
2. `npm run dev`
3. Open http://localhost:5173
4. Mention that the 6-key test panel is loaded from `key.config.json`
   (units in meters, `base_link` frame, approach axis `-z`).

## Walkthrough

### 1. Show the dashboard shell (15s)

- Top bar — Vantage Arm branding + Phase B tag.
- Left — `ThreeScene` placeholder (until Person 1's `feat/scene-urdf` lands)
  and the 6-key test panel directly underneath.
- Right column stack — Joint State → Safety → Joystick → Move To → Keyboard →
  Voice → Autonomous PIN.
- Bottom — Status Log wired to the live `robotStore`.

### 2. Read-only state (15s)

- Point out `Joint State` showing J1–J6 angles and the end-effector pose.
- Mention `Safety` shows the system pill as **Ready** until something trips it.

### 3. Show the scene (20s)

- Walk through `ThreeScene` / `ArmModel` / `TargetMarker` rendering: end-effector
  circle (orange) and target circle (dashed green) on the grid.
- Note that the scene respects `window.__VA_USE_REAL_SCENE__` so Person 1's
  full 3D model can be swapped in without touching the dashboard.

### 4. Joystick command (20s)

- In the joystick panel, click **Z+** twice → Status Log records
  `Command [JOG_AXIS] received from [joystick]` twice, with `axis: 'z'`
  and a delta of `0.02m` each.
- Click **X+**, **X-**, **Y+**, **Y-**, **Z-** once each → six additional
  JOG_AXIS log entries.
- Click **Home** → Status Log records `Command [HOME] received from
  [joystick]` and `motionPipeline` returns `targetPosition = (0.5, 0.0, 0.05)`.
- Click **Stop** → Status Log records `Command [STOP] received from
  [joystick]`. Safety does NOT trip — STOP clears `activeCommandSource`
  but leaves the safety latch alone.
- Note that nothing in the panel mutates `robotStore` directly. The adapter
  only calls `executeCommand`.

### 5. Move To command (15s)

- In the Move To panel, change X to `0.65` and click **Move To** → Status Log
  records `Command [MOVE_TO] received from [dashboard]`. `targetPosition`
  in the store updates to `(0.65, 0.00, 0.10)`.
- Click **Reset defaults** → the form returns to the safe defaults
  `(0.55, 0.00, 0.10)`.

### 6. Keyboard command (20s)

- Click somewhere on the page so it has focus (avoid the input fields).
- Press `W` once, `Q` twice → three `JOG_AXIS` log entries with `axis: 'x'`
  then `axis: 'z'` twice.
- Press `H` → Status Log records `Command [HOME] received from [keyboard]`.
- Press `Space` → Status Log records `Command [STOP] received from
  [keyboard]`. (No safety pill change — STOP is a soft halt.)
- Hold a key down to demonstrate repeat suppression: only the first keydown
  fires; the listener re-arms on keyup.

### 7. Voice typed fallback (20s)

- In the Voice panel, click the **press key two** chip → Status Log records
  `Command [TAP_KEY] received from [voice]` with `keyId: '2'`.
- Click **move up**, **move down**, **move left**, **move right**, **move
  forward**, **move backward** chips in turn → six JOG_AXIS log entries with
  axis `z`, `z`, `x`, `x`, `y`, `y` respectively.
- Click **enter pin 123456** → Status Log records
  `Command [RUN_PIN] received from [voice]` with `pin: '123456'`.
- Click **home** and **stop** → HOME then STOP log entries.
- Type a bogus phrase and Send → the panel reports `Unrecognized` and the
  Status Log shows no command entry.

### 8. Autonomous PIN entry (20s)

- Open the Autonomous PIN panel. Notice the placeholder "123456" and the hint
  "digits 1-6".
- Try typing `7` in the text field → the input rejects it, only digits 1-6 are
  accepted, and a `Only digits 1-6 are allowed.` warning shows under the field.
- Click the keypad to compose `145236` (or any 6-digit test PIN).
- Click **Execute PIN** → Status Log shows
  `Command [RUN_PIN] received from [pin-panel]`.
- Explain that Person 2's `pinRunner.js` orchestrates the hover / touch /
  verify / retract sequence behind the scenes. The shell validates the
  6-digit format up-front and reports the pipeline result.

### 9. Close (10s)

- Recap the **single shared motion pipeline** invariant: every input source
  (joystick buttons, Move-To form, keyboard, typed voice, autonomous PIN,
  safety Halt/Reset) calls the same `executeCommand(command)` function. That
  is why nothing in the dashboard mutates the robot state directly.

## Hardware tie-in (optional, 30s)

If time allows, open `circuit/wokwi-link.md` and `circuit/pin-mapping.md` to
walk through the ESP32 + PCA9685 servo-driver proof-of-concept, then
reference `docs/problem-analysis.md` (or `docs/validation-plan.md`) for the
validation plan and edge cases.
