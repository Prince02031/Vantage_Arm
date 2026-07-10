// TargetMarker.jsx
// Creates and manages a visual target marker in the Three.js scene.
// The marker shows where the IK is trying to move the stylus tip.
import * as THREE from 'three';

const RING_COLOR = 0x00e5ff;  // Cyan ring
const SPHERE_COLOR = 0xffffff;  // White center dot
const RING_SEGS = 32;

/**
 * Create a target marker group (ring + center sphere + vertical axis line).
 * @returns {{ group: THREE.Group, setPosition: (x:number, y:number, z:number) => void, setVisible: (v:boolean) => void }}
 */
export function createTargetMarker() {
    const group = new THREE.Group();
    group.name = 'targetMarker';
    group.visible = false; // hidden until a target is set

    // Outer ring
    const ringGeo = new THREE.TorusGeometry(0.025, 0.003, 8, RING_SEGS);
    const ringMat = new THREE.MeshBasicMaterial({ color: RING_COLOR, depthTest: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2; // lie flat in XZ plane
    group.add(ring);

    // Inner sphere
    const dotGeo = new THREE.SphereGeometry(0.006, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: SPHERE_COLOR, depthTest: false });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    group.add(dot);

    // Vertical axis indicator line
    const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, -0.04, 0),
        new THREE.Vector3(0, 0.04, 0),
    ]);
    const lineMat = new THREE.LineBasicMaterial({ color: RING_COLOR, depthTest: false });
    group.add(new THREE.Line(lineGeo, lineMat));

    function setPosition(x, y, z) {
        group.position.set(x, y, z);
        group.visible = true;
    }

    function setVisible(v) {
        group.visible = v;
    }

    return { group, setPosition, setVisible };
}
