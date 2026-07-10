// testIntegration.js
// QA integration verification script for Phase C.
// Runs the exact required pipeline commands, verifies safety and invalid command rejection.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Define requestAnimationFrame and cancelAnimationFrame for Node.js environment
globalThis.requestAnimationFrame = (callback) => {
  return setTimeout(() => {
    callback(performance.now());
  }, 16);
};
globalThis.cancelAnimationFrame = (id) => {
  clearTimeout(id);
};

// Import core modules
import { executeCommand, registerRobotAdapter, setKeyConfig } from '../src/core/motionPipeline.js';
import { getRobotState } from '../src/core/robotStore.js';
import { solveIK, computeForwardKinematics } from '../src/robotics/ikSolver.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const keyConfigPath = path.resolve(__dirname, '../public/config/key.config.json');
const keyConfig = JSON.parse(fs.readFileSync(keyConfigPath, 'utf-8'));

// Initialize keyConfig in pipeline
setKeyConfig(keyConfig);

// Start with all joints at 0
let jointAngles = {
  joint_1: 0,
  joint_2: 0,
  joint_3: 0,
  joint_4: 0,
  joint_5: 0,
  joint_6: 0,
  stylus_pitch: 0
};

const mockAdapter = {
  getRobot() {
    return { name: "mockURDF" };
  },
  getMovableJoints() {
    const list = [
      { name: "joint_1", limits: { lower: -3.1416, upper: 3.1416 } },
      { name: "joint_2", limits: { lower: -2.0944, upper: 2.0944 } },
      { name: "joint_3", limits: { lower: -2.6180, upper: 2.6180 } },
      { name: "joint_4", limits: { lower: -3.1416, upper: 3.1416 } },
      { name: "joint_5", limits: { lower: -2.0944, upper: 2.0944 } },
      { name: "joint_6", limits: { lower: -3.1416, upper: 3.1416 } },
      { name: "stylus_pitch", limits: { lower: -2.0944, upper: 2.0944 } }
    ];
    list.includes = (el) => list.some(j => j.name === String(el));
    list.indexOf = (el) => list.findIndex(j => j.name === String(el));
    return list;
  },
  getJointLimits() {
    return {
      joint_1: { lower: -3.1416, upper: 3.1416, min: -3.1416, max: 3.1416 },
      joint_2: { lower: -2.0944, upper: 2.0944, min: -2.0944, max: 2.0944 },
      joint_3: { lower: -2.6180, upper: 2.6180, min: -2.6180, max: 2.6180 },
      joint_4: { lower: -3.1416, upper: 3.1416, min: -3.1416, max: 3.1416 },
      joint_5: { lower: -2.0944, upper: 2.0944, min: -2.0944, max: 2.0944 },
      joint_6: { lower: -3.1416, upper: 3.1416, min: -3.1416, max: 3.1416 },
      stylus_pitch: { lower: -2.0944, upper: 2.0944, min: -2.0944, max: 2.0944 }
    };
  },
  getJointAngles() {
    return { ...jointAngles };
  },
  setJointAngles(angles) {
    jointAngles = { ...jointAngles, ...angles };
    return { set: Object.keys(angles), notFound: [] };
  },
  getEndEffectorPosition() {
    const fk = computeForwardKinematics(jointAngles);
    return { x: fk.tip.x, y: fk.tip.y, z: fk.tip.z };
  },
  updateTargetMarker(target) {
    // mock no-op
  },
  flashKey(key) {
    console.log(`[Mock] Visual FLASH Key:`, key);
  }
};

// Register the mock adapter
registerRobotAdapter(mockAdapter);

// Helper to print test result
function printTest(name, result) {
  if (result) {
    console.log(`[PASS] ${name}`);
  } else {
    console.error(`[FAIL] ${name}`);
  }
}

async function runTests() {
  console.log("=== Vantage Arm Phase C Integration QA Tests ===\n");

  // Ensure system safety is reset
  await executeCommand({ type: "resetSafety", source: "qa" });

  // 1. Scene/Adapter Checks
  const ee = mockAdapter.getEndEffectorPosition();
  printTest("getEndEffectorPosition returns finite coordinates", 
    Number.isFinite(ee.x) && Number.isFinite(ee.y) && Number.isFinite(ee.z) && (ee.x !== 0 || ee.y !== 0 || ee.z !== 0)
  );

  // 2. executeCommand: moveTo (0.55, 0, 0.10) first so the arm is inside workspace bounds!
  console.log("\nTesting: executeCommand moveTo (0.55, 0, 0.10)...");
  const moveRes = await executeCommand({ type: "moveTo", target: { x: 0.55, y: 0, z: 0.10 }, source: "qa" });
  console.log("moveResult:", moveRes);
  printTest("moveTo resolves successfully", moveRes.ok === true);

  // 3. executeCommand: jog x
  console.log("\nTesting: executeCommand jog x by 0.02m...");
  const jogRes = await executeCommand({ type: "jog", axis: "x", delta: 0.02, source: "qa" });
  console.log("jogResult:", jogRes);
  printTest("jog x command resolves successfully", jogRes.ok === true);

  // 4. executeCommand: home
  console.log("\nTesting: executeCommand home...");
  const homeRes = await executeCommand({ type: "home", source: "qa" });
  console.log("homeResult:", homeRes);
  printTest("home command resolves successfully", homeRes.ok === true);

  // Bring back to (0.55, 0, 0.10) before key press
  await executeCommand({ type: "moveTo", target: { x: 0.55, y: 0, z: 0.10 }, source: "qa" });

  // 5. executeCommand: pressKey 5
  console.log("\nTesting: executeCommand pressKey 5...");
  const pressRes = await executeCommand({ type: "pressKey", key: "5", source: "qa" });
  console.log("pressResult:", pressRes);
  printTest("pressKey 5 executes successfully", pressRes.ok === true);
  
  const state = getRobotState();
  printTest("lastKeyPressResult is updated in state store", 
    state.lastKeyPressResult && state.lastKeyPressResult.key === "5" && state.lastKeyPressResult.success === true
  );

  // 6. Invalid command tests
  console.log("\nTesting invalid commands...");

  // - invalid key 9 rejected
  try {
    const res9 = await executeCommand({ type: "pressKey", key: "9", source: "qa" });
    printTest("invalid key 9 is rejected", res9.ok === false);
  } catch (err) {
    printTest("invalid key 9 causes rejection or throw", true);
  }

  // Ensure system is reset after any potential trip
  await executeCommand({ type: "resetSafety", source: "qa" });

  // - invalid PIN 120456 rejected
  const pinRes = await executeCommand({ type: "runPin", pin: "120456", source: "qa" });
  printTest("invalid PIN 120456 containing 0 is rejected", pinRes.ok === false);

  // - out-of-bounds target rejected
  const boundsRes = await executeCommand({ type: "moveTo", target: { x: 1.5, y: 0, z: 0.10 }, source: "qa" });
  printTest("out-of-bounds target target is rejected", boundsRes.ok === false);

  // - invalid axis rejected
  const axisRes = await executeCommand({ type: "jog", axis: "w", delta: 0.02, source: "qa" });
  printTest("invalid axis 'w' is rejected", axisRes.ok === false);

  console.log("\n=== Integration QA Tests Completed ===");
  process.exit(0);
}

runTests().catch(err => {
  console.error("QA tests crashed:", err);
  process.exit(1);
});
