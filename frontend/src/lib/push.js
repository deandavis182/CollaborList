import { apiClient } from './api'

// Convert a base64url-encoded VAPID public key to the Uint8Array the
// PushManager.subscribe applicationServerKey requires.
export function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

export async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return null
  try {
    return await navigator.serviceWorker.register('/sw.js')
  } catch (e) {
    console.warn('SW registration failed:', e)
    return null
  }
}

export function getPermission() {
  if (typeof Notification === 'undefined') return 'unsupported'
  return Notification.permission // 'default' | 'granted' | 'denied'
}

export function pushSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    typeof Notification !== 'undefined'
  )
}

export async function subscribeToPush(vapidPublicKey) {
  if (!pushSupported() || !vapidPublicKey) return null
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return null
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
  })
  const json = sub.toJSON()
  await apiClient.post('/push/subscribe', {
    subscription: { endpoint: json.endpoint, keys: json.keys },
  })
  return json
}

export async function unsubscribeFromPush() {
  if (!pushSupported()) return false
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (!sub) return false
  const endpoint = sub.endpoint
  await sub.unsubscribe()
  await apiClient.post('/push/unsubscribe', { endpoint })
  return true
}
