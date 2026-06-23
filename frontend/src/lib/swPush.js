// Pure helpers shared with the service worker. No DOM / no SW globals here so
// they are unit-testable; sw.js wires them to self.addEventListener.

export function notificationTargetUrl(data) {
  if (data && typeof data.url === 'string' && data.url) return data.url
  return '/'
}

export function buildNotification(payload) {
  const data = payload && typeof payload === 'object' ? payload : {}
  return {
    title: data.title || 'CollaborList',
    options: {
      body: data.body || '',
      tag: data.tag || undefined,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: notificationTargetUrl(data) },
    },
  }
}
