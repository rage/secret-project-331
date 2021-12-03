import { useRouter } from "next/router"
import React, { useEffect, useState } from "react"
import ReactDOM from "react-dom"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { PublicQuiz, Quiz, QuizAnswer } from "../../types/types"
import { Renderer } from "../components/Renderer"
import { SubmissionResult } from "../shared-module/bindings"
import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"
import { ViewType } from "../shared-module/iframe-protocol-types"
import { isSetStateMessage } from "../shared-module/iframe-protocol-types.guard"

export interface SubmissionData {
  submission_result: SubmissionResult
  user_answer: QuizAnswer
  public_spec: unknown
}

const IFrame: React.FC = () => {
  const { t } = useTranslation()

  const [port, setPort] = useState<MessagePort | null>(null)
  const [state, setState] = useState<SubmissionData | Quiz | PublicQuiz | null>(null)
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
            if (data.view_type === "exercise") {
              ReactDOM.flushSync(() => {
                setState(
                  (data.data as any).public_spec.current_exercise_task.public_spec as PublicQuiz,
                )
                setViewType(data.view_type)
              })
            } else if (data.view_type === "exercise-editor") {
              ReactDOM.flushSync(() => {
                if (data.data === null) {
                  setState(emptyQuiz)
                } else {
                  setState(JSON.parse(data.data as string) as Quiz)
                }
                setViewType(data.view_type)
              })
            } else if (data.view_type === "view-submission") {
              ReactDOM.flushSync(() => {
                setState(data.data as SubmissionData)
                setViewType(data.view_type)
              })
            } else if (data.view_type === "playground-exercise") {
              ReactDOM.flushSync(() => {
                setState(data.data as PublicQuiz)
                setViewType(data.view_type)
              })
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

  if (!state || !viewType) {
    return <>{t("waiting-for-content")}</>
  }
  return (
    <HeightTrackingContainer port={port}>
      <Renderer
        maxWidth={maxWidth}
        port={port}
        setState={setState}
        state={state}
        viewType={viewType}
      />
    </HeightTrackingContainer>
  )
}

const DEFAULT_GRANT_POINTS_POLICY = "grant_whenever_possible"

// Empty quiz for newly created quiz exercises
const emptyQuiz: Quiz = {
  id: v4(),
  autoConfirm: true,
  autoReject: false,
  awardPointsEvenIfWrong: false,
  body: "",
  courseId: v4(),
  createdAt: new Date(),
  deadline: new Date(),
  excludedFromScore: true,
  grantPointsPolicy: DEFAULT_GRANT_POINTS_POLICY,
  items: [],
  part: 0,
  points: 0,
  section: 0,
  submitMessage: "",
  title: "",
  tries: 1,
  triesLimited: true,
  updatedAt: new Date(),
  open: new Date(),
}

export default IFrame
