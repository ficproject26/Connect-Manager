import React from 'react';

const StatusBadge = ({ status }) => {
  const normStatus = (status || 'Pending').toLowerCase().replace(/\s+/g, '-');
  return (
    <span className={`status-badge ${normStatus}`}>
      <span className="status-dot"></span>
      {status || 'Pending'}
    </span>
  );
};

export default StatusBadge;
