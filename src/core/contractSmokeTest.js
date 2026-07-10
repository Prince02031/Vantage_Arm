// src/core/contractSmokeTest.js
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { createJogCommand, COMMAND_TYPES } from './commandTypes.js';
import { validateCommand } from './safetyValidator.js';
import { executeCommand, setKeyConfig } from './motionPipeline.js';
import { runPin, pressKey } from './pinRunner.js';

// Resolve key.config.json path dynamically in Node environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const keyConfigPath = path.resolve(__dirname, '../../public/config/key.config.json');
const keyConfig = JSON.parse(fs.readFileSync(keyConfigPath, 'utf-8'));

// Initialize keyConfig in pipeline
setKeyConfig(keyConfig);

let total = 0;
let passed = 0;

function assert(description, condition) {
  total++;
  if (condition) {
    passed++;
    console.log(`[PASS] ${description}`);
  } else {
    console.error(`[FAIL] ${description}`);
  }
}

console.log("=== VANTAGE ARM: PHASE A CONTRACT SMOKE TEST ===");

try {
  // 1. createJogCommand returns expected structure.
  const jogCmd = createJogCommand('x', 0.05, 'keyboard');
  assert("createJogCommand structure matches schema", 
    jogCmd.type === COMMAND_TYPES.JOG && 
    jogCmd.axis === 'x' && 
    jogCmd.delta === 0.05 && 
    jogCmd.source === 'keyboard'
  );

  // 2. invalid axis is rejected.
  const badJog = createJogCommand('w', 0.02, 'keyboard');
  const badJogCheck = validateCommand(badJog);
  assert("invalid axis 'w' is rejected by safetyValidator", badJogCheck.ok === false);

  // 3. moveTo outside workspace is rejected.
  const badMove = {
    type: "moveTo",
    target: { x: 0.95, y: 0.0, z: 0.10 }, // X is 0.95 (exceeds limit 0.75)
    source: "dashboard"
  };
  const badMoveCheck = validateCommand(badMove);
  assert("moveTo outside conservative workspace bounds is rejected", badMoveCheck.ok === false);

  // 4. valid PIN 123456 is accepted.
  const pinCheck = validateCommand({ type: "runPin", pin: "123456" });
  assert("valid PIN 123456 is accepted", pinCheck.ok === true);

  // 5. invalid PIN 120456 is rejected.
  const badPinCheck = validateCommand({ type: "runPin", pin: "120456" });
  assert("invalid PIN 120456 containing '0' is rejected", badPinCheck.ok === false);

  // 6. pressKey("5") plan contains approach/touch/retreat when keyConfig is provided.
  const keyPlan = pressKey("5", { keyConfig });
  assert("pressKey('5') targets plan contains approach/touch/retreat coordinates", 
    keyPlan.ok === true && 
    keyPlan.targets.approach && 
    keyPlan.targets.touch && 
    keyPlan.targets.retreat
  );

  // 7. executeCommand({ type: "stop" }) returns ok.
  executeCommand({ type: "stop", source: "keyboard" }).then(res => {
    assert("executeCommand('stop') returns success status", res.ok === true);

    // 8. executeCommand({ type: "runPin", pin: "123456" }) validates and returns structured result or pending result.
    executeCommand({ type: "runPin", pin: "123456", source: "dashboard" }).then(pinRes => {
      assert("executeCommand('runPin') returns ok with pendingImplementation", 
        pinRes.ok === true && 
        pinRes.pendingImplementation === true
      );

      console.log(`\nSMOKE TEST SUMMARY: ${passed}/${total} assertions passed.`);
      if (passed !== total) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    }).catch(err => {
      console.error("runPin execution crashed:", err);
      process.exit(1);
    });
  }).catch(err => {
    console.error("stop execution crashed:", err);
    process.exit(1);
  });

} catch (e) {
  console.error("Smoke test compilation/runtime crashed:", e);
  process.exit(1);
}
