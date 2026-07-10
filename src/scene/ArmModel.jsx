// ArmModel.jsx
// Wraps the loaded URDF robot THREE.Object3D.
// Provides a helper to safely set joint angles by name.
import * as THREE from 'three';

/**
 * Safely set the angle of one joint on a urdf-loader robot.
 * urdf-loader joints respond to setJointValue(angle).
 *
 * @param {object} robot        - urdf-loader robot object.
 * @param {string} jointName    - Name of the joint (e.g. 'joint_1').
 * @param {number} anglRad      - Desired angle in radians.
 * @returns {boolean}           - true if the joint was found and updated.
 */
export function setOneJoint(robot, jointName, anglRad) {
    const joint = robot?.joints?.[jointName];
    if (!joint) return false;

    // Clamp to joint limits if available
    const lo = joint.limit?.lower ?? -Math.PI;
    const hi = joint.limit?.upper ?? Math.PI;
    const clamped = Math.max(lo, Math.min(hi, anglRad));

    // urdf-loader v0.11 exposes setJointValue(value)
    if (typeof joint.setJointValue === 'function') {
        joint.setJointValue(clamped);
    } else {
        // Fallback: rotate the joint object directly along its axis
        const axis = joint.axis ?? new THREE.Vector3(0, 0, 1);
        joint.quaternion.setFromAxisAngle(axis, clamped);
    }
    return true;
}

/**
 * Set multiple joints at once.
 * @param {object} robot                          - urdf-loader robot.
 * @param {{ [jointName: string]: number }} angles - Map of joint name → angle (rad).
 * @returns {{ set: string[], notFound: string[] }}
 */
export function setJointAngles(robot, angles) {
    const set = [];
    const notFound = [];
    for (const [name, angle] of Object.entries(angles ?? {})) {
        if (setOneJoint(robot, name, angle)) {
            set.push(name);
        } else {
            notFound.push(name);
        }
    }
    return { set, notFound };
}

/**
 * Read all current joint angles from a loaded robot.
 * @param {object} robot - urdf-loader robot.
 * @returns {{ [jointName: string]: number }}
 */
export function getJointAngles(robot) {
    const result = {};
    for (const [name, joint] of Object.entries(robot?.joints ?? {})) {
        // urdf-loader stores the current angle in jointValue or angle
        result[name] = joint.angle ?? joint.jointValue ?? 0;
    }
    return result;
}
