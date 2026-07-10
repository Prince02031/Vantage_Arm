# Phase A Contract Verification & Smoke Tests

This document describes the validation and smoke testing setup for Vantage Arm's Phase A contracts.

---

## Smoke Test Script

A zero-dependency smoke test script has been implemented in [contractSmokeTest.js](file:///d:/WebDev/Hackathon/RS%20Techathon/Vantage_Arm/src/core/contractSmokeTest.js). It runs in the Node environment using native ES modules to verify contract interfaces.

### Verification Items
1. **createJogCommand Structure**: Ensures jog creators format commands with standard types, keys, and values.
2. **Axis Gating**: Assures that invalid Cartesian axes (e.g., `'w'`) are blocked by the safety validator.
3. **Workspace Boundary Gating**: Verifies that `moveTo` commands targets outside bounds are correctly rejected.
4. **Valid PIN Format**: Verifies that standard 6-digit PIN inputs composed of keys 1-6 are accepted.
5. **Invalid PIN Format**: Verifies that inputs containing out-of-range keys (e.g., `'0'`, `'9'`) or incorrect lengths are blocked.
6. **PressKey Planning Targets**: Confirms that targeting a key yields three-dimensional coordinates for approach (hover), touch, and retreat.
7. **Emergency Stop Command**: Assures stop commands are executed cleanly and return successful confirmation.
8. **Autonomous PIN Command**: Verifies that submitting a PIN command validates the sequence format and returns an execution report (flagged as pending implementation in Phase A).

---

## Running the Smoke Test

To run the verification test suite, run the following command in your terminal:

```bash
npm run test:smoke
```

### Expected Output
```text
=== VANTAGE ARM: PHASE A CONTRACT SMOKE TEST ===
[PASS] createJogCommand structure matches schema
[PASS] invalid axis 'w' is rejected by safetyValidator
[PASS] moveTo outside conservative workspace bounds is rejected
[PASS] valid PIN 123456 is accepted
[PASS] invalid PIN 120456 containing '0' is rejected
[PASS] pressKey('5') targets plan contains approach/touch/retreat coordinates
[PASS] executeCommand('stop') returns success status
[PASS] executeCommand('runPin') returns ok with pendingImplementation

SMOKE TEST SUMMARY: 8/8 assertions passed.
```
