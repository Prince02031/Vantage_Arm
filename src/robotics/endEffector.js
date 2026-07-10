// endEffector.js
// Utilities for reading the end-effector (stylus_tip) world position from a
// loaded urdf-loader robot object.
import * as THREE from 'three';

const _vec = new THREE.Vector3();

/**
 * Return the world-space position of the end-effector link.
 *
 * Strategy (in priority order):
 *   1. Use robot.links['stylus_tip'] — the fixed TCP frame defined in the URDF.
 *   2. Fall back to any link whose name matches typical TCP patterns.
 *   3. Fall back to the world position of the robot's own origin.
 *
 * @param {object} robot  - urdf-loader robot object (THREE.Object3D subclass).
 * @returns {{ x: number, y: number, z: number }}
 */
export function getEndEffectorWorldPosition(robot) {
    if (!robot) return { x: 0, y: 0, z: 0 };

    // 1. Preferred: stylus_tip (fixed TCP frame)
    const preferred = ['stylus_tip', 'stylus', 'tcp', 'tool_frame', 'ee_link'];
    for (const name of preferred) {
        const link = robot.links?.[name];
        if (link) {
            link.getWorldPosition(_vec);
            return { x: _vec.x, y: _vec.y, z: _vec.z };
        }
    }

    // 2. Pattern match
    const pattern = /tip|tcp|tool|end|gripper|ee$/i;
    const links = Object.values(robot.links ?? {});
    const byName = links.find((l) => pattern.test(l.name));
    if (byName) {
        byName.getWorldPosition(_vec);
        return { x: _vec.x, y: _vec.y, z: _vec.z };
    }

    // 3. Last resort: robot origin
    robot.getWorldPosition(_vec);
    return { x: _vec.x, y: _vec.y, z: _vec.z };
}

/**
 * Return the world-space position of a named link.
 * @param {object} robot
 * @param {string} linkName
 * @returns {{ x: number, y: number, z: number } | null}
 */
export function getLinkWorldPosition(robot, linkName) {
    const link = robot?.links?.[linkName];
    if (!link) return null;
    link.getWorldPosition(_vec);
    return { x: _vec.x, y: _vec.y, z: _vec.z };
}
