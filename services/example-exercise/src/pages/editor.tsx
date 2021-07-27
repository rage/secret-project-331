import { useEffect, useState } from "react"

import Editor from "../components/Editor"
import useStateWithOnChange from "../hooks/useStateWithOnChange"
import { Alternative } from "../util/stateInterfaces"

const EditorPage: React.FC = () => {
  const [port, setPort] = useState<MessagePort | null>(null)
  const [state, setState] = useStateWithOnChange<Alternative[] | null>(null, (newValue) => {
    if (!port) {
      console.error("State changed but port is not set. Cannot send current state.")
      return
    }
    const message = {
      message: "current-state",
      data: { private_spec: newValue },
    }
    console.log("Sending current data", JSON.stringify(message))
    port.postMessage(message)
  })

  // const router = useRouter()
  // const rawMaxWidth = router?.query?.width
  // let _maxWidth: number | null = null
  // if (rawMaxWidth) {
  //   _maxWidth = Number(rawMaxWidth)
  // }

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
          if (data.message === "set-state") {
            console.log("Frame: setting state from message")
            setState(data.data || [])
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

  return <Editor onHeightChange={onHeightChange} state={state} setState={setState} port={port} />
}

function onHeightChange(newHeight: number, port: MessagePort) {
  port.postMessage({
    message: "height-changed",
    data: newHeight,
  })
}

export default EditorPage
