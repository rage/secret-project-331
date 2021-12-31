import React, { Dispatch, SetStateAction } from "react"
import { useTranslation } from "react-i18next"

import ContentRenderer from "../.."
import { Block } from "../../../../services/backend"
import { CourseMaterialExerciseTask } from "../../../../shared-module/bindings"
import { IframeState } from "../../../../shared-module/iframe-protocol-types"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import { defaultContainerWidth } from "../../../../shared-module/styles/constants"

import ExerciseTaskIframe from "./ExerciseTaskIframe"

interface ExerciseTaskProps {
  cannotAnswerButNoSubmission: boolean
  exerciseTask: CourseMaterialExerciseTask
  isExam: boolean
  postThisStateToIFrame: IframeState | null
  setAnswer: Dispatch<unknown>
  setAnswerValid: Dispatch<SetStateAction<boolean>>
}

const ExerciseTask: React.FC<ExerciseTaskProps> = ({
  cannotAnswerButNoSubmission,
  exerciseTask,
  isExam,
  postThisStateToIFrame,
  setAnswer,
  setAnswerValid,
}) => {
  const { t } = useTranslation()

  const currentExerciseTaskAssignment = exerciseTask.assignment as Block<unknown>[]
  const url = exerciseTask.exercise_iframe_url

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
      {cannotAnswerButNoSubmission && (
        <div className={normalWidthCenteredComponentStyles}>
          {t("no-submission-received-for-this-exercise")}
        </div>
      )}
      {!cannotAnswerButNoSubmission &&
        (url ? (
          <ExerciseTaskIframe
            postThisStateToIFrame={postThisStateToIFrame}
            url={`${url}?width=${defaultContainerWidth}`}
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
