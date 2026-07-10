// urdfRobot.js
// Thin loader wrapper around urdf-loader with sensible defaults.
import * as THREE from 'three';
import URDFLoader from 'urdf-loader';

const DEFAULT_PKG = '/';

/**
 * Load a URDF from a URL using urdf-loader.
 * @param {string} url - Path or absolute URL to the .urdf file.
 * @param {object} [opts]
 * @param {THREE.Scene} [opts.scene] - Optional scene to auto-add the robot to.
 * @param {(msg: string) => void} [opts.onProgress]
 * @param {string} [opts.packages] - Base path for `package://` URIs.
 * @returns {Promise<{robot:any, manager:THREE.LoadingManager}>}
 */
export function loadUrdf(url, opts = {}) {
  const { scene, onProgress, packages = DEFAULT_PKG } = opts;

  const manager = new THREE.LoadingManager();
  if (onProgress) {
    manager.onProgress = (_url, loaded, total) => onProgress(`${loaded}/${total}`);
  }

  const loader = new URDFLoader(manager);
  loader.packages = packages;
  // Use a soft white material when the URDF references a missing texture.
  loader.defaultMaterial = new THREE.MeshStandardMaterial({
    color: 0xb0b6bd,
    metalness: 0.1,
    roughness: 0.7,
  });

  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (robot) => {
        robot.name = robot.name || 'robot';
        if (scene) scene.add(robot);
        resolve({ robot, manager });
      },
      undefined,
      (err) => reject(err instanceof Error ? err : new Error(String(err))),
    );
  });
}
