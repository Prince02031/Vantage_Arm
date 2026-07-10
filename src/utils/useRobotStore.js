// src/utils/useRobotStore.js
import { useEffect, useState } from 'react';
import { robotStore } from '../core/robotStore.js';

/**
 * Subscribe a React component to robotStore updates.
 * Returns the latest snapshot from the store.
 */
export function useRobotStore() {
  const [snapshot, setSnapshot] = useState(robotStore.getState());

  useEffect(() => {
    const unsubscribe = robotStore.subscribe((next) => setSnapshot(next));
    return () => { if (typeof unsubscribe === 'function') unsubscribe(); };
  }, []);

  return snapshot;
}