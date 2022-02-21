import { css } from "@emotion/css"
import { useRouter } from "next/router"
import React, { useEffect, useState } from "react"
import ReactDOM from "react-dom"
import { v4 } from "uuid"

import { ModelSolutionQuiz, PublicQuiz, Quiz, QuizAnswer } from "../../types/types"
import { Renderer } from "../components/Renderer"
import { StudentExerciseTaskSubmissionResult } from "../shared-module/bindings"
import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"
import { isSetStateMessage } from "../shared-module/iframe-protocol-types.guard"

import { ItemAnswerFeedback } from "./api/grade"

export interface SubmissionData {
  submission_result: StudentExerciseTaskSubmissionResult
  user_answer: QuizAnswer
  public_spec: unknown
}

export type State =
  | { viewType: "exercise"; publicSpec: PublicQuiz }
  | {
      viewType: "view-submission"
      publicSpec: PublicQuiz
      modelSolutions: ModelSolutionQuiz | null
      userAnswer: QuizAnswer
      feedbackJson: ItemAnswerFeedback[] | null
    }
  | { viewType: "exercise-editor"; privateSpec: Quiz }

const IFrame: React.FC = () => {
  const [port, setPort] = useState<MessagePort | null>(null)
  const [state, setState] = useState<State | null>(null)
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
                setState({
                  viewType: data.view_type,
                  publicSpec: data.data.public_spec as PublicQuiz,
                })
              } else if (data.view_type === "exercise-editor") {
                if (data.data.private_spec === null) {
                  setState({
                    viewType: data.view_type,
                    privateSpec: emptyQuiz,
                  })
                } else {
                  setState({
                    viewType: data.view_type,
                    privateSpec: JSON.parse(data.data.private_spec as string),
                  })
                }
              } else if (data.view_type === "view-submission") {
                setState({
                  viewType: data.view_type,
                  publicSpec: data.data.public_spec as PublicQuiz,
                  modelSolutions: data.data.model_solution_spec as ModelSolutionQuiz | null,
                  userAnswer: data.data.user_answer as QuizAnswer,
                  feedbackJson: data.data.grading?.feedback_json as ItemAnswerFeedback[] | null,
                })
              } else {
                // eslint-disable-next-line i18next/no-literal-string
                console.error("Unknown view type received from parent")
              }
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

  return (
    <HeightTrackingContainer port={port}>
      <div
        className={css`
          width: 100%;
          ${maxWidth && `max-width: ${maxWidth}px;`}
          margin: 0 auto;
        `}
      >
        <Renderer port={port} setState={setState} state={state} />
      </div>
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
