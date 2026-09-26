import React, { createContext, useContext, useState, useEffect } from 'react';
import { realtimeClient } from '../realtime/websocketClient';

const RealtimeContext = createContext({
  isConnected: false,
  isConnecting: false,
  lastEvent: null,
  latencyMs: 0,
  reconnect: () => {}
});

export const RealtimeProvider = ({ children }) => {
  const [status, setStatus] = useState(realtimeClient.getStatus());
  const [lastEvent, setLastEvent] = useState(null);

  useEffect(() => {
    const handleConnected = () => {
      setStatus(realtimeClient.getStatus());
    };

    const handleDisconnected = () => {
      setStatus(realtimeClient.getStatus());
    };

    const handleEvent = (e) => {
      setLastEvent(e.detail);
      setStatus(realtimeClient.getStatus());
    };

    window.addEventListener('connect:ws:connected', handleConnected);
    window.addEventListener('connect:ws:disconnected', handleDisconnected);
    window.addEventListener('connect:event', handleEvent);

    return () => {
      window.removeEventListener('connect:ws:connected', handleConnected);
      window.removeEventListener('connect:ws:disconnected', handleDisconnected);
      window.removeEventListener('connect:event', handleEvent);
    };
  }, []);

  const reconnect = () => {
    const token = localStorage.getItem('agent_mgr_token');
    if (token) {
      realtimeClient.connect(token);
    }
  };

  return (
    <RealtimeContext.Provider
      value={{
        isConnected: status.isConnected,
        isConnecting: status.isConnecting,
        lastEvent,
        latencyMs: status.lastLatencyMs,
        reconnect,
        client: realtimeClient
      }}
    >
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtimeContext = () => useContext(RealtimeContext);
export default RealtimeContext;
