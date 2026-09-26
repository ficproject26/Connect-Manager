import { useEffect, useRef } from 'react';
import realtimeClient from './realtimeClient';

/**
 * React hook to listen for real-time entity updates without reloading the page.
 * @param {string} entity - Entity to listen for (e.g., 'task', 'vendor', 'agent', 'wallet', '*')
 * @param {Function} onEvent - Callback executed with event payload { event, entity, entityId, action, data, version }
 * @param {Array} deps - Dependency array
 */
export function useRealtime(entity, onEvent, deps = []) {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  useEffect(() => {
    if (!entity) return;

    const unsubscribe = realtimeClient.on(entity, (event) => {
      if (handlerRef.current) {
        handlerRef.current(event);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [entity, ...deps]);
}

/**
 * State updater helper that mutates or updates an array of records in place
 * without disturbing active form state, pagination, or filters.
 */
export function applyRealtimeUpdate(prevList, event, idField = '_id') {
  if (!Array.isArray(prevList)) return prevList;
  const { action, entityId, data } = event;
  const targetId = String(entityId || data?._id || data?.id);

  if (action === 'deleted') {
    return prevList.filter(item => String(item[idField] || item.id) !== targetId);
  }

  if (action === 'created') {
    // If not already in list, prepend
    const exists = prevList.some(item => String(item[idField] || item.id) === targetId);
    if (!exists && data) {
      return [data, ...prevList];
    }
    return prevList;
  }

  if (action === 'updated') {
    const idx = prevList.findIndex(item => String(item[idField] || item.id) === targetId);
    if (idx >= 0) {
      const updatedList = [...prevList];
      updatedList[idx] = { ...updatedList[idx], ...data };
      return updatedList;
    }
  }

  return prevList;
}

export default useRealtime;
