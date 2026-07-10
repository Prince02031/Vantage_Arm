# Phase D Handoff - Person 2: Autonomous PIN Entry

## Overview
Phase D implements full autonomous 6-digit PIN entry via `executeCommand({ type: "runPin", pin, source })`.
The sequence routes through the shared motion pipeline and executes `pressKey()` for each digit one at a time.

---

## Files Changed

| File | Change |
|------|--------|
| `src/core/pinRunner.js` | Full async `runPin()` execution with per-key results, stop support, and progress tracking |
| `src/core/robotStore.js` | Extended `pinProgress` state schema with `currentKey`, `results`, `failureReason`, `running` |
| `src/core/motionPipeline.js` | Delegated `RUN_PIN` case to async `runPin()` from `pinRunner.js` |
| `src/core/safetyValidator.js` | Enhanced `RUN_PIN` validation to verify each digit coordinate exists in `keyConfig` |
| `scratch/testIntegration.js` | Added Phase D test cases |
| `docs/person-2-phase-d-handoff.md` | This file |

---

## Validation Rules

A PIN is accepted if and only if:
1. It is a string exactly 6 characters long.
2. Every character is a digit from 1 to 6 (matches `/^[1-6]{6}$/`).
3. Every digit has a corresponding coordinate entry in `keyConfig.keys`.

Invalid PINs (e.g. containing 0, 7, or wrong length) are rejected by safetyValidator before the pipeline runs. The rejection does NOT trip the safety latch.

---

## Stop Behavior

- A stop command calls `requestStop()` in `robotStore`.
- The `runPin()` loop checks `isStopRequested()` before each digit.
- The `trajectoryRunner` also cancels the active trajectory mid-motion.
- The PIN sequence returns `ok: false` with `failureReason` populated.
- `pinProgress` shows `failed: true`, `complete: false`, `running: false`.

---

## Progress State Shape

`
{
  pin: "123456",
  currentIndex: 3,
  currentKey: "4",
  pressed: ["1","2","3"],
  results: [
    { key: "1", index: 0, ok: true, errorM: 0.00448, message: "...", timestamp: ... },
    ...
  ],
  failed: false,
  failureReason: "",
  complete: false,
  running: true
}
`

---

## Manual Test Results

### runPin("123456") - PASS
- All 6 keys pressed in sequence, all flashed.
- Per-key errors: 4.49mm, 2.05mm, 1.63mm, 4.15mm, 3.11mm, 3.76mm (all < 5mm).
- pinProgress.complete = true, pressed = 6, results = 6.

### runPin("654321") - PASS
- All keys pressed in reverse order. All errors < 5mm.
- pinProgress.complete = true.

### runPin("120456") - CORRECTLY REJECTED
- Safety validator blocked: "Invalid PIN. Must be exactly 6 digits containing only numbers 1 to 6."
- No motion executed. Safety latch NOT tripped.

### stop mid-sequence - PASS
- PIN returns ok = false.
- failureReason: "PressKey failed at approach step: Trajectory cancelled by operator request."
- pinProgress: failed = true, complete = false.

---

## Build Result

71 modules transformed. Built in 3.15s. Zero errors.

---

## Known Limitations

1. No inter-key delay - digits are pressed back-to-back. Natural timing from approach/retreat.
2. Stop is event-driven: checked between digits, not within a trajectory step.
3. No parallel execution: guaranteed by sequential await. This is by design per AGENTS.md.
4. No retry logic: if a key press fails, sequence halts immediately.
