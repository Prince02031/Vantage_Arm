// robotAdapter.js
// Null-safe adapter between URDF scene (Person 1) and motion pipeline (Person 2).
// ALL methods return safe fallback values if the robot is not yet loaded.
// Phase D: exposes setKeyActive, setKeyPressed, resetAllKeyStates, and phase-aware
// updateTargetMarker for visualizing autonomous PIN execution.
import { getEndEffectorWorldPosition } from './endEffector.js';
import { setJointAngles as _setJointAngles, getJointAngles as _getJointAngles } from '../scene/ArmModel.jsx';
import {
    flashKey as _flashKey,
    setKeyActive as _setKeyActive,
    setKeyPressed as _setKeyPressed,
    resetAllKeyStates as _resetAllKeyStates,
} from '../scene/KeyPanel.jsx';

/**
 * Create a robotAdapter.
 * Safe to call before the robot is loaded — methods return empty/zero values.
 *
 * @param {{
 *   robot: object|null,
 *   discovery: object|null,
 *   keyMeshes: THREE.Mesh[],
 *   targetMarker: object|null,
 *   trajectoryLine: object|null,
 * }} ctx
 */
export function createRobotAdapter({ robot, discovery, keyMeshes, targetMarker, trajectoryLine }) {
    // Lookup map: label → mesh
    const keyMeshMap = {};
    for (const mesh of keyMeshes ?? []) {
        const label = mesh.userData?.label;
        if (label) keyMeshMap[label] = mesh;
    }

    // Limits map: name → { lower, upper, effort, velocity }
    const limitsMap = {};
    for (const j of discovery?.joints ?? []) {
        if (j.limits) limitsMap[j.name] = j.limits;
    }

    // Internal state: last known EE position (for trajectory line updates)
    let _lastEEPos = { x: 0, y: 0, z: 0 };
    let _activePhase = 'default';

    const adapter = {
        // ── Info ──────────────────────────────────────────────────────────

        /** Raw urdf-loader robot object, or null before load. */
        getRobot() {
            return robot ?? null;
        },

        /**
         * Movable joint descriptors from joint discovery.
         * Returns custom array with string-coerced entries for backwards compatibility.
         */
        getMovableJoints() {
            if (!discovery || !discovery.movableJoints) {
                const list = [];
                list.includes = () => false;
                list.indexOf = () => -1;
                return list;
            }
            const list = discovery.movableJoints.map(j => {
                return {
                    name: j.name,
                    type: j.type,
                    axis: j.axis || null,
                    lower: j.limits?.lower !== undefined ? j.limits.lower : null,
                    upper: j.limits?.upper !== undefined ? j.limits.upper : null,
                    toString() { return this.name; },
                    valueOf() { return this.name; }
                };
            });
            list.includes = function(searchElement) {
                const searchStr = String(searchElement);
                return this.some(item => item.name === searchStr);
            };
            list.indexOf = function(searchElement) {
                const searchStr = String(searchElement);
                return this.findIndex(item => item.name === searchStr);
            };
            return list;
        },

        /**
         * Per-joint limits from URDF.
         * Returns {} if no limits parsed or robot not loaded.
         */
        getJointLimits() {
            const result = {};
            for (const [name, limitObj] of Object.entries(limitsMap)) {
                result[name] = {
                    lower: limitObj.lower !== undefined && limitObj.lower !== null ? limitObj.lower : null,
                    upper: limitObj.upper !== undefined && limitObj.upper !== null ? limitObj.upper : null,
                    min: limitObj.lower !== undefined && limitObj.lower !== null ? limitObj.lower : null,
                    max: limitObj.upper !== undefined && limitObj.upper !== null ? limitObj.upper : null
                };
            }
            return result;
        },

        // ── Live state ────────────────────────────────────────────────────

        /**
         * Current joint angles in radians, keyed by joint name.
         * Returns {} before robot loads.
         */
        getJointAngles() {
            if (!robot) return {};
            return _getJointAngles(robot);
        },

        // ── Setters ───────────────────────────────────────────────────────

        /**
         * Set one or more joint angles, clamped to URDF limits.
         * No-op (returns notFound list) if robot not loaded.
         * @param {{ [jointName: string]: number }} angles — radians
         * @returns {{ set: string[], notFound: string[] }}
         */
        setJointAngles(angles) {
            if (!robot) {
                const notFound = Object.keys(angles ?? {});
                console.warn('[robotAdapter] setJointAngles called before robot loaded', notFound);
                return { set: [], notFound };
            }
            return _setJointAngles(robot, angles);
        },

        // ── Computed ──────────────────────────────────────────────────────

        /**
         * TCP world position in metres.
         * Returns { x:0, y:0, z:0 } before robot loads.
         */
        getEndEffectorPosition() {
            if (!robot) return { x: 0, y: 0, z: 0 };
            const pos = getEndEffectorWorldPosition(robot);
            _lastEEPos = pos;
            return pos;
        },

        // ── Visual ────────────────────────────────────────────────────────

        /**
         * Move target marker to a world position.
         * Phase D: accepts optional phase string to update marker color.
         * No-op if marker not ready.
         * @param {{ x:number, y:number, z:number }} target
         * @param {string} [phase] — 'approach'|'touch'|'retreat'|'default'
         */
        updateTargetMarker(target, phase) {
            if (!target || !targetMarker) return;
            const x = typeof target.x === 'number' && Number.isFinite(target.x) ? target.x : 0;
            const y = typeof target.y === 'number' && Number.isFinite(target.y) ? target.y : 0;
            const z = typeof target.z === 'number' && Number.isFinite(target.z) ? target.z : 0;
            _activePhase = phase || 'default';
            targetMarker.setPosition(x, y, z, _activePhase);

            // Update trajectory line from last EE to this target
            if (trajectoryLine) {
                const ee = adapter.getEndEffectorPosition();
                trajectoryLine.update(ee, { x, y, z }, _activePhase);
            }
        },

        /**
         * Flash the key box labelled `key` ("1"–"6") with a gold success pulse.
         * No-op if key not found.
         * @param {string|number} key
         */
        flashKey(key) {
            const mesh = keyMeshMap[String(key)];
            if (mesh) _flashKey(mesh);
            else console.warn(`[robotAdapter] flashKey: no mesh for key "${key}"`);
        },

        /**
         * Phase D: Highlight a key as the currently active target.
         * @param {string|number} key
         * @param {boolean} active
         */
        setKeyActive(key, active) {
            const mesh = keyMeshMap[String(key)];
            if (mesh) _setKeyActive(mesh, active);
        },

        /**
         * Phase D: Mark a key as successfully pressed (persistent green glow).
         * @param {string|number} key
         * @param {boolean} pressed
         */
        setKeyPressed(key, pressed) {
            const mesh = keyMeshMap[String(key)];
            if (mesh) _setKeyPressed(mesh, pressed);
        },

        /**
         * Phase D: Reset all key visual states (e.g. at start of new PIN).
         */
        resetAllKeyStates() {
            _resetAllKeyStates(Object.values(keyMeshMap));
            if (trajectoryLine) trajectoryLine.hide();
            if (targetMarker) targetMarker.setVisible(false);
        },

        /**
         * Phase D: Hide the trajectory line (e.g. when motion completes or stops).
         */
        hideTrajectoryLine() {
            if (trajectoryLine) trajectoryLine.hide();
        },
    };

    return adapter;
}
