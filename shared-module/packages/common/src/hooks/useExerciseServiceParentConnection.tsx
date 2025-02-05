import { useEffect, useState } from "react"

/**
 * Used in exercise services when we want to establish a connection to the parent page for receiving and sending messages. The only argument is a callback function that is called when a message is received from the parent.
 *
 * How this connection establisment works and what are the allowed messages are documented here: https://github.com/rage/secret-project-331/blob/master/docs/iframes.md
 */
function useExerciseServiceParentConnection(
  onMessage: (messageData: unknown, port: MessagePort) => void,
) {
  const [port, setPort] = useState<MessagePort | null>(null)
  useEffect(() => {
    const handler = (message: WindowEventMap["message"]) => {
      if (message.source !== parent) {
        return
      }
      const port = message.ports[0]
      if (port) {
        console.info("Frame received a port:", port)
        setPort(port)
        port.onmessage = (message: WindowEventMap["message"]) => {
          if (message.data.message) {
            console.groupCollapsed(`Frame received a ${message.data.message} message from port`)
          } else {
            console.groupCollapsed(`Frame received a message from port`)
          }

          console.info(JSON.stringify(message.data, undefined, 2))
          const data = message.data
          try {
            onMessage(data, port)
          } catch (e) {
            console.error(`Iframe onMessage handler crashed`, e)
          }

          console.groupEnd()
        }
      }
    }

    console.info("frame adding event listener")
    addEventListener("message", handler)
    // target origin is *, beacause this is a sandboxed iframe without the
    // allow-same-origin permission
    parent.postMessage("ready", "*")

    // cleanup function
    return () => {
      console.info("removing event listener")
      removeEventListener("message", handler)
    }
  }, [onMessage])
  return port
}

export default useExerciseServiceParentConnection
 removeEventListener("message", handler)
    }
  }, [onMessage])
  return port
}

export default useExerciseServiceParentConnection
