// jointDiscovery.js
// Parses a loaded URDF robot (from urdf-loader) and extracts the
// information Person 1 needs: movable joints, names, types, axes,
// limits, parent/child links, and a heuristic end-effector guess.

/**
 * @typedef {Object} DiscoveredJoint
 * @property {string} name
 * @property {string} type           - revolute | continuous | prismatic | fixed | ...
 * @property {boolean} movable
 * @property {[number, number, number]} axis
 * @property {{lower:number, upper:number, effort:number, velocity:number} | null} limits
 * @property {string} parent
 * @property {string} child
 * @property {[number, number, number]} origin_xyz
 * @property {[number, number, number]} origin_rpy
 */

/**
 * @typedef {Object} DiscoveryResult
 * @property {string} robotName
 * @property {string[]} links
 * @property {string[]} materials
 * @property {DiscoveredJoint[]} joints
 * @property {DiscoveredJoint[]} movableJoints
 * @property {string | null} endEffector
 * @property {string} endEffectorReason
 */

/** Convert an array-like / THREE.Vector3 to a plain [x,y,z] tuple. */
function toVec3(v, fallback = [0, 0, 0]) {
  if (!v) return [...fallback];
  if (Array.isArray(v)) return [v[0] ?? 0, v[1] ?? 0, v[2] ?? 0];
  if (typeof v.x === 'number') return [v.x, v.y, v.z];
  return [...fallback];
}

/** Read limit values from a urdf-loader joint object. */
function readLimits(joint) {
  const limit = joint.limit;
  if (!limit) return null;
  return {
    lower: typeof limit.lower === 'number' ? limit.lower : null,
    upper: typeof limit.upper === 'number' ? limit.upper : null,
    effort: typeof limit.effort === 'number' ? limit.effort : null,
    velocity: typeof limit.velocity === 'number' ? limit.velocity : null,
  };
}

/** Build a flat joint record from a urdf-loader joint. */
function describeJoint(joint) {
  return {
    name: joint.name,
    type: joint.jointType,
    movable: joint.jointType === 'revolute' || joint.jointType === 'continuous' || joint.jointType === 'prismatic',
    axis: toVec3(joint.axis, [1, 0, 0]),
    limits: readLimits(joint),
    parent: joint.parent?.name ?? null,
    child: joint.child?.name ?? null,
    origin_xyz: toVec3(joint.origin?.position),
    origin_rpy: toVec3(joint.origin?.rotation),
  };
}

/**
 * Heuristic end-effector detection.
 * Strategy:
 *   1. Prefer a link named like a TCP / tip / tool / end / gripper.
 *   2. Otherwise pick the deepest non-fixed joint's child link
 *      (longest chain from base).
 *   3. Otherwise pick the link that is never a parent in any joint.
 */
function guessEndEffector(robot, joints) {
  const allLinks = Object.values(robot.links ?? {}).map((l) => l.name);
  if (allLinks.length === 0) return { name: null, reason: 'no links found' };

  // 1. Name match
  const eePatterns = /tip|tcp|tool|end|gripper|ee$/i;
  const named = allLinks.find((n) => eePatterns.test(n));
  if (named) return { name: named, reason: 'name matches TCP/tip/tool pattern' };

  // 2. Build adjacency
  const parentToChildren = new Map();
  const childSet = new Set();
  for (const j of joints) {
    if (!parentToChildren.has(j.parent)) parentToChildren.set(j.parent, []);
    parentToChildren.get(j.parent).push(j);
    if (j.child) childSet.add(j.child);
  }
  const rootCandidates = allLinks.filter((l) => !childSet.has(l));
  const root = rootCandidates[0] ?? allLinks[0];

  // 3. BFS to find deepest movable branch
  let deepest = { link: root, depth: 0, via: null };
  const queue = [{ link: root, depth: 0, via: null }];
  while (queue.length) {
    const { link, depth, via } = queue.shift();
    if (depth > deepest.depth) deepest = { link, depth, via };
    for (const j of parentToChildren.get(link) ?? []) {
      queue.push({ link: j.child, depth: depth + 1, via: j.name });
    }
  }

  if (deepest.via) {
    return {
      name: deepest.link,
      reason: `deepest link in kinematic chain (reached via joint "${deepest.via}", depth ${deepest.depth})`,
    };
  }
  return { name: deepest.link, reason: 'only link available' };
}

/**
 * Discover all structural information from a loaded urdf-loader robot.
 * @param {object} robot - The robot object returned by urdf-loader.
 * @returns {DiscoveryResult}
 */
export function inspectUrdf(robot) {
  if (!robot) throw new Error('inspectUrdf: robot is null/undefined');

  const rawJoints = Object.values(robot.joints ?? {});
  const joints = rawJoints.map(describeJoint);
  const movableJoints = joints.filter((j) => j.movable);

  const links = Object.values(robot.links ?? {}).map((l) => l.name);
  const materials = Object.keys(robot.materials ?? {});

  const ee = guessEndEffector(robot, joints);

  return {
    robotName: robot.name ?? '(unnamed)',
    links,
    materials,
    joints,
    movableJoints,
    endEffector: ee.name,
    endEffectorReason: ee.reason,
  };
}

/** Pretty-print a DiscoveryResult for the browser console. */
export function printDiscovery(result) {
  /* eslint-disable no-console */
  console.group(`[URDF] robot: ${result.robotName}`);
  console.log('links    :', result.links);
  console.log('materials:', result.materials);
  console.log(`joints   : ${result.joints.length} total, ${result.movableJoints.length} movable`);
  console.table(
    result.joints.map((j) => ({
      name: j.name,
      type: j.type,
      movable: j.movable,
      axis: j.axis.map((n) => +n.toFixed(3)).join(','),
      lower: j.limits?.lower ?? '-',
      upper: j.limits?.upper ?? '-',
      parent: j.parent,
      child: j.child,
    })),
  );
  console.log(`end-effector: ${result.endEffector}  (${result.endEffectorReason})`);
  console.groupEnd();
  /* eslint-enable no-console */
}
