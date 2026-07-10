// src/utils/math3d.js
export const vec3 = {
  add: (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z }),
  scale: (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s })
};
