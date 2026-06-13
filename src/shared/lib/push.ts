const PUSH_URL = "https://functions.poehali.dev/15654fa0-379e-402f-8cf3-dae50bb13ee5";

function getToken() {
  return localStorage.getItem("fc_session") || "";
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
}

async function pushCall(action: string, body?: object) {
  const token = getToken();
  const res = await fetch(PUSH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { "X-Session-Id": token } : {}),
    },
    body: JSON.stringify({ action, ...body }),
  });
  const text = await res.text();
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === "string" ? JSON.parse(parsed) : parsed;
  } catch {
    return {};
  }
}

export async function getVapidPublicKey(): Promise<string> {
  const data = await pushCall("get_vapid_public_key");
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

  await pushCall("subscribe", {
    endpoint: subscription.endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  });

  return true;
}

export async function sendPushNotification(chatId: number, title: string, message: string) {
  try {
    await pushCall("send_push", { chatId, title, message });
  } catch {
    // silent — уведомления не критичны
  }
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  await navigator.serviceWorker.register("/sw.js");
}
