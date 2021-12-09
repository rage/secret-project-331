import { useRouter } from "next/router"
import React, { useEffect, useState } from "react"
import ReactDOM from "react-dom"
import { useTranslation } from "react-i18next"

import { Renderer } from "../components/Renderer"
import { SubmissionResult } from "../shared-module/bindings"
import { ViewType } from "../shared-module/iframe-protocol-types"
import { isSetStateMessage } from "../shared-module/iframe-protocol-types.guard"
import { Alternative, Answer, PublicAlternative } from "../util/stateInterfaces"

export interface SubmissionData {
  submission_result: SubmissionResult
  user_answer: Answer
  public_spec: PublicAlternative[]
}

const Iframe: React.FC = () => {
  const { t } = useTranslation()

  const [port, setPort] = useState<MessagePort | null>(null)
  const [state, setState] = useState<SubmissionData | Alternative[] | PublicAlternative[] | null>(
    null,
  )
  const [viewType, setViewType] = useState<ViewType | null>(null)
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
          console.log(data)
          if (isSetStateMessage(data)) {
            ReactDOM.flushSync(() => {
              if (data.view_type === "exercise") {
                setState(
                  (data.data as any).public_spec.current_exercise_task
                    .public_spec as PublicAlternative[],
                )
              } else if (data.view_type === "exercise-editor") {
                setState((JSON.parse(data.data as string) as Alternative[]) || [])
              } else if (data.view_type === "view-submission") {
                setState(data.data as SubmissionData)
              } else if (data.view_type === "playground-exercise") {
                setState(data.data as PublicAlternative[])
              } else {
                // eslint-disable-next-line i18next/no-literal-string
                console.error("Unknown view type received from parent")
              }
              setViewType(data.view_type)
            })
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
  }, [])

  if (!port) {
    return <>{t("waiting-for-port")}</>
  }

  if (!state || !viewType) {
    return <>{t("waiting-for-content")}</>
  }
  return (
    <Renderer
      maxWidth={maxWidth}
      port={port}
      setState={setState}
      state={state}
      viewType={viewType}
    />
  )
}

export default Iframe
