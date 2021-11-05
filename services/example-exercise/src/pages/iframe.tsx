import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import Editor from "../components/Editor"
import Exercise from "../components/Exercise"
import useStateWithOnChange from "../hooks/useStateWithOnChange"
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
  const [submissionState, setSubmissionState] = useState<SubmissionState | null>(null)
  const [editorState, setEditorState] = useStateWithOnChange<Alternative[] | null>(
    null,
    (newValue) => postCurrentEditorState(port, newValue),
  )
  const [exerciseState, setExerciseState] = useState<PublicAlternative[] | null>(null)
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
              setExerciseState(data.data.current_exercise_task.public_spec as PublicAlternative[])
            } else if (data.view_type === "exercise-editor") {
              setEditorState(data.data as Alternative[])
            } else if (data.view_type === "view-submission") {
              setSubmissionState(data.data as SubmissionState)
            } else {
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
  }, [setEditorState, setExerciseState])

  if (!port) {
    return <>{t("waiting-for-port")}</>
  }

  if (exerciseState) {
    return (
      <Exercise maxWidth={maxWidth} port={port} state={exerciseState} setState={setExerciseState} />
    )
  } else if (editorState) {
    return <Editor maxWidth={maxWidth} port={port} state={editorState} setState={setEditorState} />
  } else if (submissionState) {
    return <Submission />
  } else {
    return <>{t("waiting-for-content")}</>
  }
}

function postCurrentExerciseState(port: MessagePort | null, data: string | null) {
  if (!port) {
    return
  }
  port.postMessage({
    message: "current-state",
    data: { selectedOptionId: data },
    valid: true,
  })
}

function postCurrentEditorState(port: MessagePort | null, data: Alternative[] | null) {
  if (!port) {
    return
  }
  port.postMessage({
    message: "current-state",
    data: { private_spec: data },
    valid: true,
  })
}

export default Iframe
