// motionPipeline.js
// Shared motion-control pipeline.
// Person 2 will fill in the full executeCommand logic.
// Person 1 (scene) registers the robotAdapter here after URDF loads.

let _adapter = null;

/**
 * Register the robot adapter so the pipeline can move the arm.
 * Called once by ThreeScene after the URDF is fully loaded.
 * @param {object} adapter
 */
export function registerRobotAdapter(adapter) {
    _adapter = adapter;
    // eslint-disable-next-line no-console
    console.log('[MotionPipeline] robotAdapter registered:', Object.keys(adapter));
}

/**
 * Get the currently registered adapter (may be null before URDF loads).
 * @returns {object|null}
 */
export function getRobotAdapter() {
    return _adapter;
}

/**
 * Execute a motion command through the pipeline.
 * Person 2 will expand this with safety validation, IK, and trajectory running.
 * @param {{ type: string, payload: object, source: string }} command
 */
export function executeCommand(command) {
    if (!_adapter) {
        // eslint-disable-next-line no-console
        console.warn('[MotionPipeline] executeCommand called before adapter registered', command);
        return;
    }
    // Stub: directly set joints if a SET_JOINTS command is received
    if (command.type === 'SET_JOINTS' && command.payload?.angles) {
        _adapter.setJointAngles(command.payload.angles);
    }
    // Person 2 will add: safety gate, IK solver, trajectory runner, etc.
}
