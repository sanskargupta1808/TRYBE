import { useEffect, useRef, useCallback } from "react";

type SignalHandler = (msg: Record<string, unknown>) => void;

export function useSignaling(userId: string | undefined, onMessage: SignalHandler) {
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const send = useCallback((msg: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "register", userId }));
    };
    socket.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        onMessageRef.current(msg);
      } catch {}
    };
    socket.onerror = () => {};
    socket.onclose = () => {};

    return () => {
      socket.close();
      wsRef.current = null;
    };
  }, [userId]);

  return { send };
}
