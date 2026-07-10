// TargetMarker.jsx
// Creates and manages a visual target marker in the Three.js scene.
// The marker shows where the IK is trying to move the stylus tip.
// Phase D: supports approach/touch/retreat phase color coding.
import * as THREE from 'three';

// Phase color map
const PHASE_COLORS = {
    approach: 0x00e5ff,  // Cyan  — hovering above key
    touch:    0xffd700,  // Gold  — descending to contact
    retreat:  0x00ff88,  // Green — retreating from key
    default:  0x00e5ff,  // Cyan  — fallback / moveTo
};

const RING_SEGS = 32;

/**
 * Create a target marker group (ring + center sphere + vertical axis line).
 * Supports phase-based color updates for PIN press visualization.
 *
 * @returns {{
 *   group: THREE.Group,
 *   setPosition: (x:number, y:number, z:number, phase?:string) => void,
 *   setPhase: (phase:string) => void,
 *   setVisible: (v:boolean) => void
 * }}
 */
export function createTargetMarker() {
    const group = new THREE.Group();
    group.name = 'targetMarker';
    group.visible = false; // hidden until a target is set

    // Outer ring
    const ringGeo = new THREE.TorusGeometry(0.025, 0.003, 8, RING_SEGS);
    const ringMat = new THREE.MeshBasicMaterial({ color: PHASE_COLORS.default, depthTest: false });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2; // lie flat in XZ plane
    group.add(ring);

    // Inner sphere
    const dotGeo = new THREE.SphereGeometry(0.006, 8, 8);
    const dotMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false });
    const dot = new THREE.Mesh(dotGeo, dotMat);
    group.add(dot);

    // Vertical axis indicator line
    const linePoints = [new THREE.Vector3(0, -0.04, 0), new THREE.Vector3(0, 0.04, 0)];
    const lineGeo = new THREE.BufferGeometry().setFromPoints(linePoints);
    const lineMat = new THREE.LineBasicMaterial({ color: PHASE_COLORS.default, depthTest: false });
    const axisLine = new THREE.Line(lineGeo, lineMat);
    group.add(axisLine);

    // Phase label sprite (canvas text)
    let labelSprite = null;
    try {
        labelSprite = _buildLabelSprite('');
        labelSprite.position.set(0, 0.06, 0);
        labelSprite.scale.set(0.12, 0.04, 1);
        group.add(labelSprite);
    } catch (_) {
        // Skip in test environments without canvas
    }

    let currentPhase = 'default';

    function _applyPhaseColor(phase) {
        const col = PHASE_COLORS[phase] ?? PHASE_COLORS.default;
        ringMat.color.setHex(col);
        lineMat.color.setHex(col);
        currentPhase = phase;
        if (labelSprite) {
            _updateLabelSprite(labelSprite, phase !== 'default' ? phase.toUpperCase() : '', col);
        }
    }

    function setPosition(x, y, z, phase) {
        group.position.set(x, y, z);
        group.visible = true;
        if (phase && phase !== currentPhase) {
            _applyPhaseColor(phase);
        }
    }

    function setPhase(phase) {
        _applyPhaseColor(phase || 'default');
    }

    function setVisible(v) {
        group.visible = v;
    }

    return { group, setPosition, setPhase, setVisible };
}

// ── Internal helpers ───────────────────────────────────────────────

function _buildLabelSprite(text) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false });
    const sprite = new THREE.Sprite(mat);
    sprite.userData._canvas = canvas;
    sprite.userData._tex = tex;
    return sprite;
}

function _updateLabelSprite(sprite, text, colorHex) {
    const canvas = sprite.userData._canvas;
    const tex = sprite.userData._tex;
    if (!canvas || !tex) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (text) {
        const col = `#${colorHex.toString(16).padStart(6, '0')}`;
        ctx.fillStyle = col;
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    }
    tex.needsUpdate = true;
}
