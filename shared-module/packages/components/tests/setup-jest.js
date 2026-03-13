import "@testing-library/jest-dom"

class MockPointerEvent extends MouseEvent {
  constructor(type, props) {
    super(type, props)
    Object.defineProperty(this, "pointerType", {
      value: props?.pointerType ?? "mouse",
    })
    Object.defineProperty(this, "pointerId", {
      value: props?.pointerId ?? 1,
    })
  }
}

Object.defineProperty(window, "PointerEvent", {
  value: MockPointerEvent,
})
