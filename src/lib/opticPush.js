import { supabase as SB } from './supabaseClient';
import { getDeviceId } from './fingerprint';

// Safe to be public — the private key never leaves Supabase secrets, see
// supabase/optic_push.sql footer for the send-side setup.
const VAPID_PUBLIC_KEY = 'BHfqrcaOswk7dbYWnRwH9ZeC1uzWfSb3fD3aZWCwtxpFsg28beB7jltwr-BVocxp0M8T2Ugwo3gU082QGfyboiE';

const DECIDED_KEY = 'optic_push_decided'; // 'granted' | 'denied' | 'dismissed'

export function pushSupported() {
  return typeof window !== 'undefined'
    && 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
}

/** True once the user has granted, denied, or dismissed the alert prompt on this device. */
export function hasDecidedPush() {
  try { return !!localStorage.getItem(DECIDED_KEY); } catch { return false; }
}

export function markPushDecided(outcome) {
  try { localStorage.setItem(DECIDED_KEY, outcome); } catch { /* private mode */ }
}

function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/**
 * Full opt-in flow: request Notification permission, subscribe this device
 * via the installed service worker's PushManager, store the subscription.
 * Throws on any failure — callers should catch and fall back to `markPushDecided('dismissed')`
 * style messaging rather than leaving the UI hung.
 * @param {string} eventId
 * @returns {Promise<'granted'|'denied'>}
 */
export async function subscribeToPush(eventId) {
  if (!pushSupported()) throw new Error('Push not supported on this browser');

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    markPushDecided('denied');
    return 'denied';
  }

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const json = sub.toJSON();
  const deviceFp = await getDeviceId();
  const { error } = await SB.from('push_subscriptions').upsert({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    device_fp: deviceFp,
    event_id: eventId,
    user_agent: navigator.userAgent,
  }, { onConflict: 'endpoint' });
  if (error) throw error;

  markPushDecided('granted');
  return 'granted';
}

/** Unsubscribe this device — used by a settings toggle, not wired into the UI yet. */
export async function unsubscribeFromPush() {
  if (!pushSupported()) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) return;
  const endpoint = sub.endpoint;
  await sub.unsubscribe();
  const deviceFp = await getDeviceId();
  await SB.from('push_subscriptions').delete().eq('endpoint', endpoint).eq('device_fp', deviceFp);
}
