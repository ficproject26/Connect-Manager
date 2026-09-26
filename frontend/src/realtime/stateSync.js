/**
 * Centralized State Synchronization Utilities
 * Applies real-time updates directly to frontend state immutably,
 * preserving user filters, active selections, forms, and pagination.
 */

/**
 * Updates a list of records in place based on real-time event action.
 * @param {Array} prevList - Current state array
 * @param {Object} event - Standard event payload { action, entityId, data, version }
 * @param {string} idField - Primary key field name ('_id' or 'id')
 * @returns {Array} Updated array
 */
export function applyRealtimeUpdate(prevList, event, idField = '_id') {
  if (!Array.isArray(prevList)) return prevList;
  if (!event || !event.action) return prevList;

  const { action, entityId, data } = event;
  const targetId = String(entityId || data?._id || data?.id || '');
  if (!targetId && action !== 'batch_created' && action !== 'batch_updated') return prevList;

  switch (action) {
    case 'deleted': {
      return prevList.filter(item => {
        const itemId = String(item[idField] || item.id || '');
        return itemId !== targetId;
      });
    }

    case 'created': {
      if (!data) return prevList;
      const exists = prevList.some(item => {
        const itemId = String(item[idField] || item.id || '');
        return itemId === targetId;
      });
      // Prepend to top of list if new
      return exists ? prevList : [data, ...prevList];
    }

    case 'updated':
    case 'status_changed':
    case 'allocated': {
      if (!data) return prevList;
      const index = prevList.findIndex(item => {
        const itemId = String(item[idField] || item.id || '');
        return itemId === targetId;
      });
      if (index === -1) {
        // If entity wasn't in list (e.g. just allocated to this user), add it
        return [data, ...prevList];
      }
      const updatedList = [...prevList];
      updatedList[index] = {
        ...updatedList[index],
        ...data
      };
      return updatedList;
    }

    case 'batch_created': {
      const newItems = data?.items || [];
      if (!Array.isArray(newItems) || newItems.length === 0) return prevList;
      const existingIds = new Set(prevList.map(i => String(i[idField] || i.id || '')));
      const unadded = newItems.filter(i => !existingIds.has(String(i[idField] || i.id || '')));
      return [...unadded, ...prevList];
    }

    case 'batch_updated': {
      const updatedMap = new Map();
      const items = data?.items || [];
      items.forEach(i => {
        const id = String(i[idField] || i.id || '');
        if (id) updatedMap.set(id, i);
      });
      return prevList.map(item => {
        const itemId = String(item[idField] || item.id || '');
        return updatedMap.has(itemId) ? { ...item, ...updatedMap.get(itemId) } : item;
      });
    }

    default:
      return prevList;
  }
}

/**
 * Updates a single entity object (e.g. details page state)
 */
export function applyEntityUpdate(prevEntity, event, idField = '_id') {
  if (!prevEntity || !event) return prevEntity;
  const targetId = String(event.entityId || event.data?._id || event.data?.id || '');
  const curId = String(prevEntity[idField] || prevEntity.id || '');

  if (targetId && curId && targetId !== curId) return prevEntity;

  if (event.action === 'deleted') {
    return null;
  }

  if (event.data) {
    return {
      ...prevEntity,
      ...event.data
    };
  }

  return prevEntity;
}
