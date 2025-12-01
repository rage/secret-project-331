export interface MockMessagePort {
  postMessage: jest.Mock
  onmessage: ((event: MessageEvent) => void) | null
  addEventListener: jest.Mock
  removeEventListener: jest.Mock
  start: jest.Mock
  close: jest.Mock
}

export interface MockMessageChannel {
  port1: MockMessagePort
  port2: MockMessagePort
}

export function createMockMessagePort(): MockMessagePort {
  return {
    postMessage: jest.fn(),
    onmessage: null,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    start: jest.fn(),
    close: jest.fn(),
  }
}

export function createMockMessageChannel(): MockMessageChannel {
  const port1 = createMockMessagePort()
  const port2 = createMockMessagePort()

  port1.postMessage.mockImplementation((data) => {
    if (port2.onmessage) {
      port2.onmessage({ data, ports: [] } as MessageEvent)
    }
  })

  port2.postMessage.mockImplementation((data) => {
    if (port1.onmessage) {
      port1.onmessage({ data, ports: [] } as MessageEvent)
    }
  })

  return { port1, port2 }
}

export function createMockMessageEvent(
  data: unknown,
  options: {
    source?: Window | null
    origin?: string
    ports?: MessagePort[]
  } = {},
): MessageEvent {
  return {
    data,
    source: options.source ?? null,
    origin: options.origin ?? "null",
    ports: options.ports ?? [],
    type: "message",
    bubbles: false,
    cancelBubble: false,
    cancelable: false,
    composed: false,
    currentTarget: null,
    defaultPrevented: false,
    eventPhase: 0,
    isTrusted: true,
    returnValue: true,
    srcElement: null,
    target: null,
    timeStamp: Date.now(),
    composedPath: () => [],
    initEvent: () => {},
    preventDefault: () => {},
    stopImmediatePropagation: () => {},
    stopPropagation: () => {},
    AT_TARGET: 2,
    BUBBLING_PHASE: 3,
    CAPTURING_PHASE: 1,
    NONE: 0,
    lastEventId: "",
    userActivation: null,
  } as MessageEvent
}

export function simulateIframeReadyMessage(
  messageHandler: (event: MessageEvent) => void,
  iframeWindow: Window,
): void {
  const event = createMockMessageEvent("ready", {
    source: iframeWindow,
    origin: "null",
  })
  messageHandler(event)
}

export function simulateParentPortTransfer(
  messageHandler: (event: MessageEvent) => void,
  port: MessagePort,
  parentWindow: Window,
): void {
  const event = createMockMessageEvent("communication-port", {
    source: parentWindow,
    origin: window.location.origin,
    ports: [port],
  })
  messageHandler(event)
}

export function createMockIframeRef(): {
  current: HTMLIFrameElement | null
} {
  const mockContentWindow = {
    postMessage: jest.fn(),
  } as unknown as Window

  const mockIframe = {
    contentWindow: mockContentWindow,
    src: "",
    height: "",
  } as unknown as HTMLIFrameElement

  return {
    current: mockIframe,
  }
}
