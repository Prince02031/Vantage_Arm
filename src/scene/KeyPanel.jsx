// KeyPanel.jsx
// Renders the 6-key test panel in a Three.js scene.
// Key coordinates are loaded at runtime from public/config/key.config.json
// — never hardcoded here.
import * as THREE from 'three';

const KEY_W = 0.030;   // 30 mm wide
const KEY_H = 0.030;   // 30 mm deep
const KEY_D = 0.010;   // 10 mm tall
const PANEL_COLOR = 0x1c2028;

const KEY_COLORS = [
    0xe05a3a, // 1 — red-orange
    0xe0913a, // 2 — amber
    0xe0c93a, // 3 — yellow
    0x57c26a, // 4 — green
    0x3a9fe0, // 5 — blue
    0xa65ae0, // 6 — purple
];

// ── Canvas label texture ───────────────────────────────────────────
function makeDigitTexture(digit, bgColor) {
    const size = 128;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = `#${bgColor.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, size, size);

    // Digit
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.font = `bold ${size * 0.55}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(digit), size / 2, size / 2);

    const tex = new THREE.CanvasTexture(canvas);
    return tex;
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Load key.config.json from the public folder and build the Three.js panel.
 * @returns {Promise<{ group: THREE.Group, keyMeshes: THREE.Mesh[], config: object }>}
 */
export async function loadAndBuildKeyPanel() {
    const res = await fetch('/config/key.config.json');
    if (!res.ok) throw new Error(`Failed to load key.config.json: ${res.status}`);
    const config = await res.json();
    const { group, keyMeshes } = buildKeyPanel(config);
    return { group, keyMeshes, config };
}

/**
 * Build the Three.js panel group from a parsed config object.
 * Separated so tests can call it without fetch.
 * @param {object} config – parsed key.config.json
 */
export function buildKeyPanel(config) {
    const group = new THREE.Group();
    group.name = 'keyPanel';

    const entries = Object.entries(config.keys); // [["1",{x,y,z}], ...]
    const xs = entries.map(([, p]) => p.x);
    const ys = entries.map(([, p]) => p.y);
    const minX = Math.min(...xs) - KEY_W * 0.9;
    const maxX = Math.max(...xs) + KEY_W * 0.9;
    const minY = Math.min(...ys) - KEY_H * 0.9;
    const maxY = Math.max(...ys) + KEY_H * 0.9;
    const refZ = entries[0][1].z;

    // Panel base plate
    const plateGeo = new THREE.BoxGeometry(maxX - minX, maxY - minY, 0.006);
    const plateMat = new THREE.MeshStandardMaterial({ color: PANEL_COLOR, roughness: 0.5, metalness: 0.4 });
    const plate = new THREE.Mesh(plateGeo, plateMat);
    plate.position.set((minX + maxX) / 2, (minY + maxY) / 2, refZ - KEY_D / 2 - 0.003);
    plate.name = 'keyPanelBase';
    group.add(plate);

    // Individual key boxes
    const keyMeshes = [];
    entries.forEach(([label, pos], i) => {
        const col = KEY_COLORS[i % KEY_COLORS.length];

        // Key body
        const geo = new THREE.BoxGeometry(KEY_W, KEY_H, KEY_D);
        const mat = new THREE.MeshStandardMaterial({
            color: col,
            roughness: 0.28,
            metalness: 0.05,
            emissive: col,
            emissiveIntensity: 0.07,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.name = `key_${label}`;
        mesh.userData = { label, config: pos, baseEmissiveIntensity: 0.07, baseColor: col };
        group.add(mesh);
        keyMeshes.push(mesh);

        // Digit label on the top face
        try {
            const tex = makeDigitTexture(label, col);
            const labelGeo = new THREE.PlaneGeometry(KEY_W * 0.72, KEY_H * 0.72);
            const labelMat = new THREE.MeshBasicMaterial({
                map: tex,
                transparent: true,
                depthWrite: false,
            });
            const labelMesh = new THREE.Mesh(labelGeo, labelMat);
            // Place just above the top face of the key
            labelMesh.position.set(pos.x, pos.y, pos.z + KEY_D / 2 + 0.0001);
            labelMesh.name = `keyLabel_${label}`;
            group.add(labelMesh);
        } catch (_) {
            // Canvas not available (e.g. unit tests): skip label
        }
    });

    return { group, keyMeshes };
}

/**
 * Flash a key mesh with a brief emissive pulse.
 * @param {THREE.Mesh} mesh
 */
export function flashKey(mesh) {
    if (!mesh?.material) return;
    const mat = mesh.material;
    const base = mesh.userData.baseEmissiveIntensity ?? 0.07;
    mat.emissiveIntensity = 1.2;
    let step = 0;
    const decay = () => {
        step += 1;
        mat.emissiveIntensity = Math.max(base, 1.2 - step * 0.07);
        if (mat.emissiveIntensity > base) requestAnimationFrame(decay);
    };
    requestAnimationFrame(decay);
}
