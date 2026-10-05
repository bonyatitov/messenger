const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "/api";

function getToken() {
  return localStorage.getItem("fc_session") || "";
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function pushFetch(path: string, method: string, body?: object) {
  const token = getToken();
  const res = await fetch(`${API_BASE_URL}/push${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Session-Id": token } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    return {};
  }
}

export async function getVapidPublicKey(): Promise<string> {
  const data = await pushFetch("/vapid-key", "GET");
  return data.publicKey || "";
}

export async function subscribeToPush(): Promise<boolean> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return false;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return false;

  const reg = await navigator.serviceWorker.ready;
  const publicKey = await getVapidPublicKey();
  if (!publicKey) return false;

  const subscription = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(publicKey),
  });

  const json = subscription.toJSON();
  const keys = json.keys as { p256dh: string; auth: string };

  await pushFetch("/subscriptions", "POST", {
    endpoint: subscription.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  });

  return true;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
  try {
    const reg = await navigator.serviceWorker.ready;
    const subscription = await reg.pushManager.getSubscription();
    if (!subscription) return;
    await pushFetch("/subscriptions", "DELETE", { endpoint: subscription.endpoint });
    await subscription.unsubscribe();
  } catch {
    // silent
  }
}

export async function sendPushNotification(chatId: number, title: string, message: string) {
  try {
    await fetch(`${API_BASE_URL}/chats/${chatId}/notify`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(getToken() ? { "X-Session-Id": getToken() } : {}),
      },
      body: JSON.stringify({ title, message }),
    });
  } catch {
    // silent — уведомления не критичны
  }
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  await navigator.serviceWorker.register("/sw.js");
}
