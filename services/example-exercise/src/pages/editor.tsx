import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import Editor from "../components/Editor"
import useStateWithOnChange from "../hooks/useStateWithOnChange"
import { CurrentStateMessage, HeightChangedMessage } from "../shared-module/iframe-protocol-types"
import { isSetStateMessage } from "../shared-module/iframe-protocol-types.guard"
import { Alternative } from "../util/stateInterfaces"

const EditorPage: React.FC = () => {
  const { t } = useTranslation()
  const [port, setPort] = useState<MessagePort | null>(null)
  const [state, setState] = useStateWithOnChange<Alternative[] | null>(null, (newValue) => {
    if (!port) {
      return
    }
    const message: CurrentStateMessage = {
      // eslint-disable-next-line i18next/no-literal-string
      message: "current-state",
      data: { private_spec: newValue },
      valid: true,
    }
    // eslint-disable-next-line i18next/no-literal-string
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
        // eslint-disable-next-line i18next/no-literal-string
        console.info("Frame received a port:", port)
        setPort(port)
        port.onmessage = (message: WindowEventMap["message"]) => {
          // eslint-disable-next-line i18next/no-literal-string
          console.info("Frame received a message from port", JSON.stringify(message.data))
          const data = message.data
          if (isSetStateMessage(data)) {
            // eslint-disable-next-line i18next/no-literal-string
            console.info("Frame: setting state from message")
            setState((data.data as Alternative[]) || [])
          } else {
            // eslint-disable-next-line i18next/no-literal-string
            console.error("Frame received an unknown message from message port")
          }
        }
      }
    }
    // eslint-disable-next-line i18next/no-literal-string
    console.info("frame adding event listener")
    addEventListener("message", handler)
    // target origin is *, beacause this is a sandboxed iframe without the
    // allow-same-origin permission
    parent.postMessage("ready", "*")

    // cleanup function
    return () => {
      // eslint-disable-next-line i18next/no-literal-string
      console.info("removing event listener")
      removeEventListener("message", handler)
    }
  }, [setState])

  // if (!maxWidth) {
  //   return null
  // }
  if (!state) {
    return <>{t("waiting-for-content")}</>
  }

  if (!port) {
    return <>{t("waiting-for-port")}</>
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
  // eslint-disable-next-line i18next/no-literal-string
  const message: HeightChangedMessage = { message: "height-changed", data: newHeight }
  port.postMessage(message)
}

export default EditorPage
