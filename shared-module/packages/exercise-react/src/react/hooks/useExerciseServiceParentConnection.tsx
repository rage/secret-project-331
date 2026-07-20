"use client"

import { useEffect, useRef, useState } from "react"

import { createParentConnection } from "@/shared-module/exercise-client/client/parentConnection"

/**
 * Used in exercise services when we want to establish a connection to the parent page for receiving and sending messages. The only argument is a callback function that is called when a message is received from the parent.
 *
 * Thin React wrapper over the framework-agnostic `createParentConnection` engine.
 *
 * How this connection establisment works and what are the allowed messages are documented here: https://github.com/rage/secret-project-331/blob/master/docs/iframes.md
 */
function useExerciseServiceParentConnection(
  onMessage: (messageData: unknown, port: MessagePort) => void,
) {
  const [port, setPort] = useState<MessagePort | null>(null)
  const onMessageRef = useRef(onMessage)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    const connection = createParentConnection({
      onMessage: (messageData, messagePort) => onMessageRef.current(messageData, messagePort),
    })
    const unsubscribe = connection.onPort(setPort)
    return () => {
      unsubscribe()
      connection.dispose()
    }
  }, [])

  return port
}

export default useExerciseServiceParentConnection
