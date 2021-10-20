import { useRouter } from "next/router"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import ExerciseBase from "../components/ExerciseBase"
import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"
import { ModelSolutionApi, PublicAlternative } from "../util/stateInterfaces"

interface SubmissionState {
  public_spec: PublicAlternative[]
  submission_data: string
  model_solution_spec: ModelSolutionApi
}

const SubmissionPage: React.FC = () => {
  const { t } = useTranslation()
  const [port, setPort] = useState<MessagePort | null>(null)
  const [state, setState] = useState<SubmissionState | null>(null)
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
          if (data.message === "set-state") {
            // eslint-disable-next-line i18next/no-literal-string
            console.info("Frame: setting state from message")
            setState(data.data)
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

  return (
    <HeightTrackingContainer port={port}>
      <ExerciseBase
        alternatives={state.public_spec}
        model_solutions={state.model_solution_spec}
        selectedId={state.submission_data}
        maxWidth={maxWidth}
        onClick={(_) => {
          // do nothing
        }}
        interactable={false}
      />
    </HeightTrackingContainer>
  )
}

export default SubmissionPage
