import { describe, it, expect } from 'vitest'
import { buildNotification, notificationTargetUrl } from '../swPush'

describe('swPush.buildNotification', () => {
  it('maps payload to title + options with data.url', () => {
    const n = buildNotification({ title: 'Assigned', body: 'Book caterer', url: '/w/1/p/2/l/3?item=9', tag: 'assign-9' })
    expect(n.title).toBe('Assigned')
    expect(n.options.body).toBe('Book caterer')
    expect(n.options.data.url).toBe('/w/1/p/2/l/3?item=9')
    expect(n.options.tag).toBe('assign-9')
  })
  it('falls back to a default title/body when missing', () => {
    const n = buildNotification({})
    expect(n.title).toBe('CollaborList')
    expect(n.options.data.url).toBe('/')
  })
})

describe('swPush.notificationTargetUrl', () => {
  it('returns the url from notification data', () => {
    expect(notificationTargetUrl({ url: '/w/1/p/2/l/3' })).toBe('/w/1/p/2/l/3')
  })
  it('defaults to / when absent', () => {
    expect(notificationTargetUrl({})).toBe('/')
    expect(notificationTargetUrl(null)).toBe('/')
  })
})
