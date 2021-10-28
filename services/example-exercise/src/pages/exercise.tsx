import { useRouter } from "next/dist/client/router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import Exercise from "../components/Exercise"
import useStateWithOnChange from "../hooks/useStateWithOnChange"
import { isSetStateMessage } from "../shared-module/iframe-protocol-types.guard"
import { PublicAlternative } from "../util/stateInterfaces"

const ExercisePage: React.FC = () => {
  const { t } = useTranslation()
  const [port, setPort] = useState<MessagePort | null>(null)
  const [state, setState] = useStateWithOnChange<PublicAlternative[] | null>(null, (newValue) => {
    if (!port) {
      return
    }
    port.postMessage({
      message: "current-state",
      data: newValue,
    })
  })
  const router = useRouter()
  const rawMaxWidth = router?.query?.width
  let maxWidth: number | null = null
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
            setState(data.data as PublicAlternative[])
          } else {
            // eslint-disable-next-line i18next/no-literal-string
            console.error("Frame received an unknown message from message port")
          }
        }
      }
    }
    addEventListener("message", handler)
    // target origin is *, beacause this is a sandboxed iframe without the
    // allow-same-origin permission
    parent.postMessage("ready", "*")

    // cleanup function
    return () => {
      removeEventListener("message", handler)
    }
  }, [setState])

  if (!maxWidth) {
    return null
  }
  if (!state) {
    return <>{t("waiting-for-content")}</>
  }

  if (!port) {
    return <>{t("waiting-for-port")}</>
  }
  return <Exercise port={port} maxWidth={maxWidth} state={state} />
}

export default ExercisePage
