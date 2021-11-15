import { useRouter } from "next/router"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import Editor from "../components/Editor"
import Exercise from "../components/Exercise"
import Submission from "../components/Submission"
import { isSetStateMessage } from "../shared-module/iframe-protocol-types.guard"
import { Alternative, ModelSolutionApi, PublicAlternative } from "../util/stateInterfaces"

interface SubmissionState {
  public_spec: PublicAlternative[]
  submission_data: string
  model_solution_spec: ModelSolutionApi
}

const Iframe: React.FC = () => {
  const { t } = useTranslation()

  const [port, setPort] = useState<MessagePort | null>(null)
  const [state, setState] = useState<SubmissionState | Alternative[] | PublicAlternative[] | null>(
    null,
  )
  const [viewType, setViewType] = useState<
    "exercise" | "view-submission" | "exercise-editor" | null
  >(null)
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
            if (data.view_type === "exercise") {
              setState(data.data.current_exercise_task.public_spec as PublicAlternative[])
              setViewType(data.view_type)
            } else if (data.view_type === "exercise-editor") {
              setState(data.data as Alternative[])
              setViewType(data.view_type)
            } else if (data.view_type === "view-submission") {
              setState(data.data as SubmissionState)
              setViewType(data.view_type)
            } else {
              // eslint-disable-next-line i18next/no-literal-string
              console.error("Iframe received an unknown view type")
            }
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

  if (!state) {
    return <>{t("waiting-for-content")}</>
  }
  if (viewType === "exercise") {
    return <Exercise maxWidth={maxWidth} port={port} state={state as PublicAlternative[]} />
  } else if (viewType === "exercise-editor") {
    return (
      <Editor maxWidth={maxWidth} port={port} state={state as Alternative[]} setState={setState} />
    )
  } else if (viewType === "view-submission") {
    return <Submission port={port} maxWidth={maxWidth} state={state} />
  } else {
    return <>{t("waiting-for-content")}</>
  }
}

export default Iframe
