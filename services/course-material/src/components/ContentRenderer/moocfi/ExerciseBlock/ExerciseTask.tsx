import React, { Dispatch, SetStateAction } from "react"
import { useTranslation } from "react-i18next"

import ContentRenderer from "../.."
import { Block } from "../../../../services/backend"
import { CourseMaterialExercise } from "../../../../shared-module/bindings"
import { IframeState } from "../../../../shared-module/iframe-protocol-types"
import { narrowContainerWidthPx } from "../../../../shared-module/styles/constants"

import ExerciseTaskIframe from "./ExerciseTaskIframe"

interface Props {
  exercise: CourseMaterialExercise
  postThisStateToIFrame: IframeState | null
  setAnswer: Dispatch<unknown>
  setAnswerValid: Dispatch<SetStateAction<boolean>>
  cannotAnswerButNoSubmission: boolean
}

const ExerciseTask: React.FC<Props> = ({
  exercise,
  postThisStateToIFrame,
  setAnswer,
  setAnswerValid,
  cannotAnswerButNoSubmission,
}) => {
  const { t } = useTranslation()

  const url = exercise.current_exercise_task_service_info?.exercise_iframe_url
  const currentExerciseTaskAssignment = exercise.current_exercise_task
    .assignment as unknown as Block<unknown>[]
  const isExam = exercise.exercise.exam_id !== null

  return (
    <div>
      {currentExerciseTaskAssignment && (
        <ContentRenderer
          data={currentExerciseTaskAssignment}
          editing={false}
          selectedBlockId={null}
          setEdits={(map) => map}
          isExam={isExam}
        />
      )}
      {cannotAnswerButNoSubmission && <div>{t("no-submission-received-for-this-exercise")}</div>}
      {!cannotAnswerButNoSubmission &&
        (url ? (
          <ExerciseTaskIframe
            postThisStateToIFrame={postThisStateToIFrame}
            url={`${url}?width=${narrowContainerWidthPx}`}
            setAnswer={setAnswer}
            setAnswerValid={setAnswerValid}
          />
        ) : (
          t("dont-know-how-to-render-this-assignment")
        ))}
    </div>
  )
}

export default ExerciseTask
