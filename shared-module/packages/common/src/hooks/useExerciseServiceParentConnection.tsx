import { useEffect, useRef, useState } from "react"

/**
 * Used in exercise services when we want to establish a connection to the parent page for receiving and sending messages. The only argument is a callback function that is called when a message is received from the parent.
 *
 * How this connection establisment works and what are the allowed messages are documented here: https://github.com/rage/secret-project-331/blob/master/docs/iframes.md
 */
function useExerciseServiceParentConnection(
  onMessage: (messageData: unknown, port: MessagePort) => void,
) {
  const [port, setPort] = useState<MessagePort | null>(null)
  const onMessageRef = useRef(onMessage)
  const portReceivedRef = useRef(false)
  const retryTimeoutRef = useRef<number | null>(null)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    if (portReceivedRef.current) {
      return
    }

    const handler = (message: WindowEventMap["message"]) => {
      if (message.source !== parent) {
        return
      }
      if (portReceivedRef.current) {
        return
      }
      const receivedPort = message.ports[0]
      if (receivedPort) {
        console.info("Frame received a port:", receivedPort)
        portReceivedRef.current = true

        if (retryTimeoutRef.current !== null) {
          clearTimeout(retryTimeoutRef.current)
          retryTimeoutRef.current = null
        }

        receivedPort.onmessage = (message: WindowEventMap["message"]) => {
          if (message.data.message) {
            console.groupCollapsed(`Frame received a ${message.data.message} message from port`)
          } else {
            console.groupCollapsed(`Frame received a message from port`)
          }

          console.info(JSON.stringify(message.data, undefined, 2))
          const data = message.data
          try {
            onMessageRef.current(data, receivedPort)
          } catch (e) {
            console.error(`Iframe onMessage handler crashed`, e)
          }

          console.groupEnd()
        }

        setPort(receivedPort)
      }
    }

    const postReady = () => {
      if (portReceivedRef.current) {
        return
      }
      console.info("frame posting ready message")
      // target origin is *, beacause this is a sandboxed iframe without the
      // allow-same-origin permission
      parent.postMessage("ready", "*")
    }

    const scheduleRetry = (attempt: number = 1) => {
      if (portReceivedRef.current) {
        return
      }
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000)
      retryTimeoutRef.current = window.setTimeout(() => {
        if (!portReceivedRef.current) {
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

    return () => {
      console.info("removing event listener")
      removeEventListener("message", handler)
      if (retryTimeoutRef.current !== null) {
        clearTimeout(retryTimeoutRef.current)
        retryTimeoutRef.current = null
      }
    }
  }, [])

  return port
}

export default useExerciseServiceParentConnection
