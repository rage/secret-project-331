import { useRouter } from "next/dist/client/router"
import { useEffect, useState } from "react"
import Editor from "../components/Editor"
import useStateWithOnChange from "../hooks/useStateWithOnChange"
import convertStateToSpecs from "../util/convertStateToSpecs"
import { Alternative } from "../util/stateInterfaces"

const EditorPage: React.FC = () => {
  const [state, setState] = useStateWithOnChange<Alternative[] | null>(null, (newValue) => {
    if (!port) {
      return
    }
    port.postMessage({
      message: "current-state-2",
      data: convertStateToSpecs(newValue),
    })
  })

  const [port, setPort] = useState<MessagePort | null>(null)
  const router = useRouter()
  const rawMaxWidth = router?.query?.width
  let maxWidth: number | null = null
  if (rawMaxWidth) {
    maxWidth = Number(rawMaxWidth)
  }

  useEffect(() => {
    const handler = (message: WindowEventMap["message"]) => {
      if (message.origin !== parent.origin) {
        return
      }
      const port = message.ports[0]
      if (port) {
        console.log("Frame received a port:", port)
        setPort(port)
        port.onmessage = (message: WindowEventMap["message"]) => {
          console.log("Frame received a message from port", JSON.stringify(message.data))
          const data = message.data
          if (data.message === "content") {
            console.log("Frame: setting state from message")
            setState(data.data)
          } else {
            console.error("Frame received an unknown message from message port")
          }
        }
      }
    }
    console.log("frame adding event listener")
    window.addEventListener("message", handler)

    // cleanup function
    return () => {
      console.log("removing event listener")
      window.removeEventListener("message", handler)
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
