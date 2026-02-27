import { useState, useEffect, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export function usePushNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    setIsSupported(supported);
    if (supported) {
      navigator.serviceWorker.ready.then(async (registration) => {
        const sub = await registration.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      });
    }
  }, []);

  const subscribe = useCallback(async () => {
    if (!isSupported) return false;
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") return false;

      const registration = await navigator.serviceWorker.ready;
      const res = await fetch("/api/push/vapid-key", { credentials: "include" });
      const { publicKey } = await res.json();
      if (!publicKey) return false;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      await apiRequest("POST", "/api/push/subscribe", { subscription: subscription.toJSON() });
      setIsSubscribed(true);
      return true;
    } catch (err) {
      console.error("Push subscription failed:", err);
      return false;
    }
  }, [isSupported]);

  const unsubscribe = useCallback(async () => {
    if (!isSupported) return;
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await apiRequest("POST", "/api/push/unsubscribe", { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }
      setIsSubscribed(false);
    } catch (err) {
      console.error("Push unsubscribe failed:", err);
    }
  }, [isSupported]);

  return { isSupported, permission, isSubscribed, subscribe, unsubscribe };
}
