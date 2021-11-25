import { Dispatch, SetStateAction } from "react"
import { useTranslation } from "react-i18next"

import { SubmissionData } from "../pages/iframe"
import { Alternative, ModelSolutionApi, PublicAlternative } from "../util/stateInterfaces"

import Editor from "./Editor"
import Exercise from "./Exercise"
import Submission from "./Submission"

interface RendererProps {
  viewType: "exercise" | "view-submission" | "exercise-editor"
  state: SubmissionData | Alternative[] | PublicAlternative[]
  setState: Dispatch<SetStateAction<SubmissionData | PublicAlternative[] | Alternative[] | null>>
  port: MessagePort
  maxWidth: number
}

export const Renderer: React.FC<RendererProps> = ({
  viewType,
  state,
  setState,
  port,
  maxWidth,
}) => {
  const { t } = useTranslation()

  if (viewType === "exercise") {
    return <Exercise maxWidth={maxWidth} port={port} state={state as PublicAlternative[]} />
  } else if (viewType === "view-submission") {
    return (
      <Submission
        port={port}
        maxWidth={maxWidth}
        publicAlternatives={(state as SubmissionData).public_spec as PublicAlternative[]}
        selectedId={(state as SubmissionData).user_answer.selectedOptionId}
        selectedOptionIsCorrect={
          (
            (state as SubmissionData).submission_result.grading.feedback_json as {
              selectedOptionIsCorrect: boolean
            }
          ).selectedOptionIsCorrect
        }
        modelSolutions={
          (state as SubmissionData).submission_result.model_solution_spec as ModelSolutionApi
        }
      />
    )
  } else if (viewType === "exercise-editor") {
    return (
      <Editor state={state as Alternative[]} maxWidth={maxWidth} port={port} setState={setState} />
    )
  } else {
    return <>{t("waiting-for-content")}</>
  }
}
