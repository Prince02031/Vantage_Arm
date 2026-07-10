// ThreeScene.jsx
// Judge-ready 3D scene: URDF arm, 6-key panel, stylus marker, target marker,
// OrbitControls for inspection, AxesHelper for orientation, live state streaming.
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadUrdf } from '../robotics/urdfRobot.js';
import { inspectUrdf, printDiscovery } from '../robotics/jointDiscovery.js';
import { loadAndBuildKeyPanel } from './KeyPanel.jsx';
import { createTargetMarker } from './TargetMarker.jsx';
import { getEndEffectorWorldPosition } from '../robotics/endEffector.js';
import { createRobotAdapter } from '../robotics/robotAdapter.js';
import { registerRobotAdapter } from '../core/motionPipeline.js';
import { getJointAngles } from './ArmModel.jsx';

const URDF_URL = '/robot/6_dof_arm.urdf';

/** Tiny green sphere that tracks the stylus_tip position. */
function buildStylusMarker() {
  const geo = new THREE.SphereGeometry(0.009, 12, 12);
  const mat = new THREE.MeshBasicMaterial({ color: 0x00ff88, depthTest: false, transparent: true, opacity: 0.9 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'stylusMarker';
  return mesh;
}

/** Build a nicely styled grid + subtle world-space axes. */
function buildFloor(scene) {
  // Main grid
  const grid = new THREE.GridHelper(4, 40, 0x2d3340, 0x1e2430);
  grid.position.y = 0;
  scene.add(grid);

  // World axes (small, at origin, below the arm)
  const axes = new THREE.AxesHelper(0.15);
  axes.position.set(0, 0.001, 0); // just above grid
  scene.add(axes);
}

let _adapterRegistered = false; // guard: register only once per page load

export default function ThreeScene({ onStateUpdate }) {
  const mountRef = useRef(null);
  const [status, setStatus] = useState('initializing…');

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 900;
    const height = mount.clientHeight || 600;

    // ── Renderer ──────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(width, height);
    renderer.setClearColor(0x0d1017);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    // ── Scene ─────────────────────────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x0d1017, 6, 18);
    buildFloor(scene);

    // ── Camera ────────────────────────────────────────────────────────
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.01, 50);
    // Start position: slightly above and to the side so arm + panel are both visible
    camera.position.set(1.4, 0.9, 1.4);
    camera.lookAt(0.35, 0.3, 0);

    // ── Orbit Controls ────────────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0.35, 0.3, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.3;
    controls.maxDistance = 6;
    controls.maxPolarAngle = Math.PI * 0.88;
    controls.update();

    // ── Lights ────────────────────────────────────────────────────────
    scene.add(new THREE.HemisphereLight(0xd0dff0, 0x334455, 0.7));

    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(3, 5, 2);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    sun.shadow.camera.near = 0.5;
    sun.shadow.camera.far = 12;
    sun.shadow.camera.left = -2.5;
    sun.shadow.camera.right = 2.5;
    sun.shadow.camera.top = 2.5;
    sun.shadow.camera.bottom = -2.5;
    scene.add(sun);

    const fill = new THREE.DirectionalLight(0x6688cc, 0.35);
    fill.position.set(-2, 1, -1);
    scene.add(fill);

    // ── Stylus marker (persists in scene; updated every tick) ──────────
    const stylusMarker = buildStylusMarker();
    scene.add(stylusMarker);

    // ── Resize observer ────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth || width;
      const h = mount.clientHeight || height;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(mount);

    // ── Render loop ────────────────────────────────────────────────────
    let raf = 0;
    let robotRef = null;
    const _pos = new THREE.Vector3();

    const tick = () => {
      raf = requestAnimationFrame(tick);
      controls.update(); // damping

      if (robotRef) {
        // Move stylus sphere to TCP
        const tipLink = robotRef.links?.['stylus_tip'];
        if (tipLink) {
          tipLink.getWorldPosition(_pos);
          stylusMarker.position.copy(_pos);
        }
        // Stream live state to Dashboard
        if (onStateUpdate) {
          onStateUpdate({
            joints: getJointAngles(robotRef),
            eef: getEndEffectorWorldPosition(robotRef),
          });
        }
      }
      renderer.render(scene, camera);
    };
    tick();

    // ── Async: URDF + key panel load ───────────────────────────────────
    let cancelled = false;
    (async () => {
      try {
        setStatus('loading URDF…');
        const { robot } = await loadUrdf(URDF_URL, { scene });
        if (cancelled) return;
        robotRef = robot;

        // Frame camera on arm
        const box = new THREE.Box3().setFromObject(robot);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;

        camera.near = maxDim / 200;
        camera.far = maxDim * 30;
        const camOffset = new THREE.Vector3(maxDim * 1.2, maxDim * 0.85, maxDim * 1.2);
        camera.position.copy(center).add(camOffset);
        controls.target.copy(center);
        controls.update();
        camera.updateProjectionMatrix();

        // Discover joints
        const discovery = inspectUrdf(robot);
        printDiscovery(discovery);

        // Key panel — runtime fetch (never hardcoded)
        setStatus('loading key panel…');
        let keyMeshes = [];
        try {
          const kp = await loadAndBuildKeyPanel();
          if (!cancelled) {
            scene.add(kp.group);
            keyMeshes = kp.keyMeshes;
            // Widen camera to include panel
            const kpBox = new THREE.Box3().setFromObject(kp.group);
            const combined = new THREE.Box3().copy(box).union(kpBox);
            const cCenter = combined.getCenter(new THREE.Vector3());
            const cSize = combined.getSize(new THREE.Vector3());
            const cMax = Math.max(cSize.x, cSize.y, cSize.z);
            controls.target.copy(cCenter);
            camera.position.copy(cCenter).add(
              new THREE.Vector3(cMax * 1.1, cMax * 0.8, cMax * 1.1)
            );
            controls.update();
          }
        } catch (kpErr) {
          console.warn('[KeyPanel] failed to load:', kpErr);
        }

        // Target marker
        const targetMarker = createTargetMarker();
        scene.add(targetMarker.group);

        // Build & register adapter exactly once per page load
        if (!_adapterRegistered) {
          _adapterRegistered = true;
          const adapter = createRobotAdapter({ robot, discovery, keyMeshes, targetMarker });
          registerRobotAdapter(adapter);
        }

        if (!cancelled) {
          setStatus(`loaded — ${discovery.movableJoints.length} movable joints | adapter ready`);
        }

      } catch (err) {
        console.error('[ThreeScene] load failed', err);
        if (!cancelled) setStatus(`error: ${err.message ?? err}`);
      }
    })();

    return () => {
      cancelled = true;
      _adapterRegistered = false; // reset so hot-reload re-registers
      cancelAnimationFrame(raf);
      controls.dispose();
      ro.disconnect();
      renderer.dispose();
      if (renderer.domElement.parentNode === mount) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, [onStateUpdate]);

  return (
    <div className="scene-root">
      <div ref={mountRef} className="scene-canvas" />
      <div className="scene-status">{status}</div>
      <div className="scene-hint">drag to orbit · scroll to zoom</div>
    </div>
  );
}
