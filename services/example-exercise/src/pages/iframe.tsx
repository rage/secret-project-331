import { css } from "@emotion/css"
import { useRouter } from "next/router"
import React, { useEffect, useState } from "react"
import ReactDOM from "react-dom"

import { Renderer } from "../components/Renderer"
import { ExerciseTaskGrading } from "../shared-module/bindings"
import HeightTrackingContainer from "../shared-module/components/HeightTrackingContainer"
import { isSetStateMessage } from "../shared-module/iframe-protocol-types.guard"
import { Alternative, Answer, ModelSolutionApi, PublicAlternative } from "../util/stateInterfaces"

import { ExerciseFeedback } from "./api/grade"

export interface SubmissionData {
  grading: ExerciseTaskGrading
  user_answer: Answer
  public_spec: PublicAlternative[]
}

export interface ExerciseData {
  alternatives: PublicAlternative[]
  initialState: Answer | null
}

export type State =
  | {
      view_type: "exercise"
      public_spec: PublicAlternative[]
    }
  | {
      view_type: "view-submission"
      public_spec: PublicAlternative[]
      selectedOptionId: string
      feedback_json: ExerciseFeedback | null
      model_solution_spec: ModelSolutionApi | null
      grading: ExerciseTaskGrading | null
    }
  | {
      view_type: "exercise-editor"
      private_spec: Alternative[]
    }

const Iframe: React.FC = () => {
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
          if (message.data.message) {
            // eslint-disable-next-line i18next/no-literal-string
            console.groupCollapsed(`Frame received a ${message.data.message} message from port`)
          } else {
            // eslint-disable-next-line i18next/no-literal-string
            console.groupCollapsed(`Frame received a message from port`)
          }

          console.info(JSON.stringify(message.data, undefined, 2))
          const data = message.data
          if (isSetStateMessage(data)) {
            ReactDOM.flushSync(() => {
              if (data.view_type === "exercise") {
                setState({
                  view_type: data.view_type,
                  public_spec: data.data.public_spec as PublicAlternative[],
                })
              } else if (data.view_type === "exercise-editor") {
                setState({
                  view_type: data.view_type,
                  private_spec:
                    (JSON.parse(data.data.private_spec as string) as Alternative[]) || [],
                })
              } else if (data.view_type === "view-submission") {
                const userAnswer = data.data.user_answer as { selectedOptionId: string }
                setState({
                  view_type: data.view_type,
                  public_spec: data.data.public_spec as PublicAlternative[],
                  selectedOptionId: userAnswer.selectedOptionId,
                  feedback_json: data.data.grading?.feedback_json as ExerciseFeedback | null,
                  model_solution_spec: data.data.model_solution_spec as ModelSolutionApi | null,
                  grading: data.data.grading,
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
          console.groupEnd()
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

export default Iframe
