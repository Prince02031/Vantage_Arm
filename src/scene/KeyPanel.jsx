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

// Flash pulse colors
const FLASH_COLOR    = 0xffd700; // Gold — success touch
const ACTIVE_COLOR   = 0xffffff; // White — currently targeting
const PRESSED_COLOR  = 0x00ff88; // Green — completed/pressed

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
            emissive: new THREE.Color(col),
            emissiveIntensity: 0.07,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(pos.x, pos.y, pos.z);
        mesh.name = `key_${label}`;
        mesh.userData = {
            label,
            config: pos,
            baseColor: col,
            baseEmissiveIntensity: 0.07,
            // State flags
            isActive: false,
            isPressed: false,
            // Pending animation timer
            _decayRaf: null,
        };
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
 * Flash a key mesh with a gold emissive pulse indicating a successful touch.
 * Cancels any pending decay loop before starting a new one.
 * @param {THREE.Mesh} mesh
 */
export function flashKey(mesh) {
    if (!mesh?.material) return;
    const mat = mesh.material;
    const base = mesh.userData.baseEmissiveIntensity ?? 0.07;

    // Cancel any in-progress decay animation
    if (mesh.userData._decayRaf) {
        cancelAnimationFrame(mesh.userData._decayRaf);
        mesh.userData._decayRaf = null;
    }

    // Set gold flash color and full emissive intensity
    mat.emissive.setHex(FLASH_COLOR);
    mat.emissiveIntensity = 1.5;

    let step = 0;
    const decay = () => {
        step += 1;
        const intensity = Math.max(base, 1.5 - step * 0.055);
        mat.emissiveIntensity = intensity;

        if (intensity > base) {
            mesh.userData._decayRaf = requestAnimationFrame(decay);
        } else {
            mesh.userData._decayRaf = null;
            // After flash, restore to pressed or base color
            if (mesh.userData.isPressed) {
                mat.emissive.setHex(PRESSED_COLOR);
                mat.emissiveIntensity = 0.55;
            } else {
                mat.emissive.setHex(mesh.userData.baseColor);
                mat.emissiveIntensity = base;
            }
        }
    };
    mesh.userData._decayRaf = requestAnimationFrame(decay);
}

/**
 * Highlight a key as the currently active target (approach or touch phase).
 * Call with active=false to de-highlight.
 * @param {THREE.Mesh} mesh
 * @param {boolean} active
 */
export function setKeyActive(mesh, active) {
    if (!mesh?.material) return;
    mesh.userData.isActive = active;

    // Don't change a key that is flashing (mid-decay)
    if (mesh.userData._decayRaf) return;

    const mat = mesh.material;
    if (active) {
        mat.emissive.setHex(ACTIVE_COLOR);
        mat.emissiveIntensity = 0.6;
    } else {
        // Restore pressed state or base
        if (mesh.userData.isPressed) {
            mat.emissive.setHex(PRESSED_COLOR);
            mat.emissiveIntensity = 0.55;
        } else {
            mat.emissive.setHex(mesh.userData.baseColor);
            mat.emissiveIntensity = mesh.userData.baseEmissiveIntensity ?? 0.07;
        }
    }
}

/**
 * Mark a key as successfully pressed (persistent dim green glow).
 * @param {THREE.Mesh} mesh
 * @param {boolean} pressed
 */
export function setKeyPressed(mesh, pressed) {
    if (!mesh?.material) return;
    mesh.userData.isPressed = pressed;

    // Don't interrupt a gold flash that's in progress
    if (mesh.userData._decayRaf) return;

    const mat = mesh.material;
    if (pressed) {
        mat.emissive.setHex(PRESSED_COLOR);
        mat.emissiveIntensity = 0.55;
    } else {
        mat.emissive.setHex(mesh.userData.baseColor);
        mat.emissiveIntensity = mesh.userData.baseEmissiveIntensity ?? 0.07;
    }
}

/**
 * Reset all visual key states (e.g. at start of new PIN sequence).
 * @param {THREE.Mesh[]} keyMeshes
 */
export function resetAllKeyStates(keyMeshes) {
    if (!Array.isArray(keyMeshes)) return;
    for (const mesh of keyMeshes) {
        if (!mesh?.material) continue;
        if (mesh.userData._decayRaf) {
            cancelAnimationFrame(mesh.userData._decayRaf);
            mesh.userData._decayRaf = null;
        }
        mesh.userData.isActive = false;
        mesh.userData.isPressed = false;
        const mat = mesh.material;
        mat.emissive.setHex(mesh.userData.baseColor);
        mat.emissiveIntensity = mesh.userData.baseEmissiveIntensity ?? 0.07;
    }
}
