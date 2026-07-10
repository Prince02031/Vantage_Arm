// TrajectoryLine.jsx
// Draws a dashed line from the current end-effector position to the active target.
// Updated every animation frame by the ThreeScene tick loop.
// Phase D: gives judges a clear visual of "where the arm is heading".
import * as THREE from 'three';

const LINE_COLOR_DEFAULT  = 0x00e5ff; // Cyan — general move
const LINE_COLOR_APPROACH = 0x00e5ff; // Cyan
const LINE_COLOR_TOUCH    = 0xffd700; // Gold
const LINE_COLOR_RETREAT  = 0x00ff88; // Green

const PHASE_COLORS = {
    approach: LINE_COLOR_APPROACH,
    touch:    LINE_COLOR_TOUCH,
    retreat:  LINE_COLOR_RETREAT,
    default:  LINE_COLOR_DEFAULT,
};

/**
 * Create a trajectory line object managed by ThreeScene.
 * @returns {{
 *   line: THREE.Line,
 *   update: (from:{x,y,z}, to:{x,y,z}, phase?:string) => void,
 *   hide: () => void
 * }}
 */
export function createTrajectoryLine() {
    // Allocate a 2-point buffer
    const positions = new Float32Array(6); // [x0,y0,z0, x1,y1,z1]
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.LineBasicMaterial({
        color: LINE_COLOR_DEFAULT,
        depthTest: false,
        transparent: true,
        opacity: 0.55,
        linewidth: 1, // only effective on some renderers
    });

    const line = new THREE.Line(geo, mat);
    line.name = 'trajectoryLine';
    line.visible = false;
    line.frustumCulled = false; // always draw even if geo center is off-screen

    let currentPhase = 'default';

    /**
     * Update the line endpoints and phase color.
     * @param {{ x:number, y:number, z:number }} from — current EE position
     * @param {{ x:number, y:number, z:number }} to   — active target
     * @param {string} [phase]                         — 'approach'|'touch'|'retreat'|'default'
     */
    function update(from, to, phase) {
        if (!from || !to) { line.visible = false; return; }

        const pos = geo.attributes.position;
        pos.setXYZ(0, from.x, from.y, from.z);
        pos.setXYZ(1, to.x,   to.y,   to.z);
        pos.needsUpdate = true;
        geo.computeBoundingSphere();

        // Update color if phase changed
        const p = phase || 'default';
        if (p !== currentPhase) {
            mat.color.setHex(PHASE_COLORS[p] ?? LINE_COLOR_DEFAULT);
            currentPhase = p;
        }

        line.visible = true;
    }

    function hide() {
        line.visible = false;
    }

    return { line, update, hide };
}
