import { useRouter } from "next/router"
import { useEffect, useState } from "react"

import Editor from "../components/Editor"
import useStateWithOnChange from "../hooks/useStateWithOnChange"
import { CurrentStateMessage, HeightChangedMessage } from "../shared-module/iframe-protocol-types"
import { isSetStateMessage } from "../shared-module/iframe-protocol-types.guard"
import { Alternative } from "../util/stateInterfaces"

const EditorPage: React.FC = () => {
  const [port, setPort] = useState<MessagePort | null>(null)
  const [state, setState] = useStateWithOnChange<Alternative[] | null>(null, (newValue) => {
    if (!port) {
      return
    }
    const message: CurrentStateMessage = {
      message: "current-state",
      data: { private_spec: newValue },
      valid: true,
    }
    console.info("Sending current data", JSON.stringify(message))
    port.postMessage(message)
  })

  const router = useRouter()
  const rawMaxWidth = router?.query?.width
  let maxWidth: number | null = 500
  if (rawMaxWidth) {
    maxWidth = Number(rawMaxWidth)
  }

  useEffect(() => {
    const handler = (message: WindowEventMap["message"]) => {
      if (message.source !== parent) {
        return
      }
      const port = message.ports[0]
      if (port) {
        console.log("Frame received a port:", port)
        setPort(port)
        port.onmessage = (message: WindowEventMap["message"]) => {
          console.log("Frame received a message from port", JSON.stringify(message.data))
          const data = message.data
          if (isSetStateMessage(data)) {
            console.log("Frame: setting state from message")
            setState((data.data as Alternative[]) || [])
          } else {
            console.error("Frame received an unknown message from message port")
          }
        }
      }
    }
    console.log("frame adding event listener")
    addEventListener("message", handler)
    // target origin is *, beacause this is a sandboxed iframe without the
    // allow-same-origin permission
    parent.postMessage("ready", "*")

    // cleanup function
    return () => {
      console.log("removing event listener")
      removeEventListener("message", handler)
    }
  }, [setState])

  // if (!maxWidth) {
  //   return null
  // }
  if (!state) {
    return <>Waiting for content...</>
  }

  if (!port) {
    return <>Waiting for port...</>
  }

  return (
    <Editor
      maxWidth={maxWidth}
      onHeightChange={onHeightChange}
      state={state}
      setState={setState}
      port={port}
    />
  )
}

function onHeightChange(newHeight: number, port: MessagePort) {
  const message: HeightChangedMessage = { message: "height-changed", data: newHeight }
  port.postMessage(message)
}

export default EditorPage
