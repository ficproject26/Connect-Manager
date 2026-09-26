import { useEffect, useRef } from 'react';
import { realtimeClient } from './websocketClient';
import { applyRealtimeUpdate, applyEntityUpdate } from './stateSync';

/**
 * React hook to listen for real-time entity updates without reloading the page.
 * @param {string} entity - Entity to listen for (e.g., 'task', 'vendor', 'agent', 'notification', '*')
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
 * React hook to automatically bind a state list to real-time events for an entity.
 * In-place updates preserve active filters, search inputs, and pagination.
 * @param {string} entity - Entity name ('task', 'vendor', etc.)
 * @param {Function} setData - React setState function for list
 * @param {Object} [options]
 * @param {string} [options.idField='_id'] - Primary key field
 * @param {Function} [options.onUpdate] - Optional custom handler
 */
export function useRealtimeSync(entity, setData, options = {}) {
  const idField = options.idField || '_id';
  const onUpdate = options.onUpdate;

  useRealtime(entity, (event) => {
    if (typeof setData === 'function') {
      setData((prev) => {
        if (!Array.isArray(prev)) return prev;
        return applyRealtimeUpdate(prev, event, idField);
      });
    }

    if (typeof onUpdate === 'function') {
      onUpdate(event);
    }
  });
}

export { applyRealtimeUpdate, applyEntityUpdate };
export default useRealtime;
