// robotAdapter.js
// Null-safe adapter between URDF scene (Person 1) and motion pipeline (Person 2).
// ALL methods return safe fallback values if the robot is not yet loaded.
import { getEndEffectorWorldPosition } from './endEffector.js';
import { setJointAngles as _setJointAngles, getJointAngles as _getJointAngles } from '../scene/ArmModel.jsx';
import { flashKey as _flashKey } from '../scene/KeyPanel.jsx';

/**
 * Create a robotAdapter.
 * Safe to call before the robot is loaded — methods return empty/zero values.
 *
 * @param {{
 *   robot: object|null,
 *   discovery: object|null,
 *   keyMeshes: THREE.Mesh[],
 *   targetMarker: object|null,
 * }} ctx
 */
export function createRobotAdapter({ robot, discovery, keyMeshes, targetMarker }) {
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
            return getEndEffectorWorldPosition(robot);
        },

        // ── Visual ────────────────────────────────────────────────────────

        /**
         * Move target marker to a world position.
         * No-op if marker not ready.
         * @param {{ x:number, y:number, z:number }} target
         */
        updateTargetMarker(target) {
            if (!target || !targetMarker) return;
            const x = typeof target.x === 'number' && Number.isFinite(target.x) ? target.x : 0;
            const y = typeof target.y === 'number' && Number.isFinite(target.y) ? target.y : 0;
            const z = typeof target.z === 'number' && Number.isFinite(target.z) ? target.z : 0;
            targetMarker.setPosition(x, y, z);
        },

        /**
         * Flash the key box labelled `key` ("1"–"6").
         * No-op if key not found.
         * @param {string|number} key
         */
        flashKey(key) {
            const mesh = keyMeshMap[String(key)];
            if (mesh) _flashKey(mesh);
            else console.warn(`[robotAdapter] flashKey: no mesh for key "${key}"`);
        },
    };

    return adapter;
}
