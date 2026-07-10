// src/utils/formatters.js
export function formatAngle(rad) {
  if (typeof rad !== 'number' || Number.isNaN(rad)) return '—';
  const deg = (rad * 180) / Math.PI;
  return `${rad.toFixed(2)} rad (${deg.toFixed(1)}°)`;
}

export function formatCoord(axis, value) {
  if (typeof value !== 'number' || Number.isNaN(value)) return `${axis}: —`;
  return `${axis}: ${value.toFixed(3)} m`;
}

export function formatTime(timestamp) {
  if (!timestamp) return '—';
  try {
    return new Date(timestamp).toLocaleTimeString();
  } catch {
    return String(timestamp);
  }
}
