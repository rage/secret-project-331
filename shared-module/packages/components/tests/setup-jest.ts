import "@testing-library/jest-dom"

import "./test-i18n"

class MockPointerEvent extends MouseEvent {
  constructor(type: string, props?: ConstructorParameters<typeof MouseEvent>[1]) {
    super(type, props)
    Object.defineProperty(this, "pointerType", {
      value: props && "pointerType" in props ? (props.pointerType ?? "mouse") : "mouse",
    })
    Object.defineProperty(this, "pointerId", {
      value: props && "pointerId" in props ? (props.pointerId ?? 1) : 1,
    })
  }
}

Object.defineProperty(window, "PointerEvent", {
  value: MockPointerEvent,
})
