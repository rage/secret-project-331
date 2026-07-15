// Framework-agnostic iframe-side connection to the parent page.
//
// This is the reusable substrate behind the React `useExerciseServiceParentConnection`
// hook: it posts the "ready" handshake, listens for the `MessagePort` the parent transfers,
// retries with exponential backoff until the port arrives, and routes incoming port messages
// to the supplied callback. It depends only on DOM APIs (no React), so vanilla-JS and other
// framework adapters can build on it.
//
// How the connection establishment works and which messages are allowed is documented at:
// https://github.com/rage/secret-project-331/blob/master/docs/iframes.md

export interface ParentConnection {
  /** The received `MessagePort`, or `null` until the handshake completes. */
  readonly port: MessagePort | null
  /**
   * Subscribe to the moment the port is received. If the port has already arrived, the
   * listener is invoked synchronously. Returns an unsubscribe function.
   */
  onPort: (listener: (port: MessagePort) => void) => () => void
  /** Remove listeners and cancel any pending retry timer. Idempotent. */
  dispose: () => void
}

export interface ParentConnectionOptions {
  /** Called for every message received on the port, with the port for replies. */
  onMessage: (messageData: unknown, port: MessagePort) => void
}

/**
 * Establish a connection to the parent page. Begins the handshake immediately.
 */
export function createParentConnection(options: ParentConnectionOptions): ParentConnection {
  let port: MessagePort | null = null
  let portReceived = false
  let retryTimeout: number | null = null
  const portListeners = new Set<(port: MessagePort) => void>()

  const handler = (message: MessageEvent) => {
    if (message.source !== parent) {
      return
    }
    if (portReceived) {
      return
    }
    const receivedPort = message.ports[0]
    if (receivedPort) {
      console.info("Frame received a port:", receivedPort)
      portReceived = true

      if (retryTimeout !== null) {
        clearTimeout(retryTimeout)
        retryTimeout = null
      }

      // oxlint-disable-next-line unicorn/prefer-add-event-listener -- intentional property-handler
      receivedPort.onmessage = (portMessage: MessageEvent) => {
        if (portMessage.data.message) {
          console.groupCollapsed(`Frame received a ${portMessage.data.message} message from port`)
        } else {
          console.groupCollapsed(`Frame received a message from port`)
        }

        console.info(JSON.stringify(portMessage.data, undefined, 2))
        try {
          options.onMessage(portMessage.data, receivedPort)
        } catch (e) {
          console.error(`Iframe onMessage handler crashed`, e)
        }

        console.groupEnd()
      }

      port = receivedPort
      portListeners.forEach((listener) => listener(receivedPort))
    }
  }

  const postReady = () => {
    if (portReceived) {
      return
    }
    console.info("frame posting ready message")
    // Use "*" so the ready message reaches the parent regardless of which host embeds the exercise.
    parent.postMessage("ready", "*")
  }

  const scheduleRetry = (attempt = 1) => {
    if (portReceived) {
      return
    }
    const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
    retryTimeout = window.setTimeout(() => {
      if (!portReceived) {
        console.info(`frame retrying ready message (attempt ${attempt})`)
        postReady()
        scheduleRetry(attempt + 1)
      }
    }, delay)
  }

  console.info("frame adding event listener")
  addEventListener("message", handler)

  postReady()
  scheduleRetry()

  return {
    get port() {
      return port
    },
    onPort(listener) {
      if (port) {
        listener(port)
      }
      portListeners.add(listener)
      return () => {
        portListeners.delete(listener)
      }
    },
    dispose() {
      console.info("removing event listener")
      removeEventListener("message", handler)
      if (retryTimeout !== null) {
        clearTimeout(retryTimeout)
        retryTimeout = null
      }
      portListeners.clear()
    },
  }
}
