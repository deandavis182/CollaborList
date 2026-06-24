import '@testing-library/jest-dom'

// jsdom does not implement PointerEvent with coordinate properties.
// This polyfill extends MouseEvent so that fireEvent.pointerDown/Move/Up
// correctly propagates clientX/clientY to React synthetic event handlers.
if (typeof PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    constructor(type, params = {}) {
      super(type, params)
      this.pointerId = params.pointerId ?? 0
    }
  }
  global.PointerEvent = PointerEvent
}
