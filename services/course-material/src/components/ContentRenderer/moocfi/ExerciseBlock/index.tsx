import { css } from "@emotion/css"
import HelpIcon from "@material-ui/icons/Help"
import { useContext, useReducer, useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery } from "react-query"

import { BlockRendererProps } from "../.."
import CoursePageContext from "../../../../contexts/CoursePageContext"
import exerciseBlockPostThisStateToIFrameReducer from "../../../../reducers/exerciseBlockPostThisStateToIFrameReducer"
import { fetchExerciseById, postSubmission } from "../../../../services/backend"
import Button from "../../../../shared-module/components/Button"
import DebugModal from "../../../../shared-module/components/DebugModal"
import LoginStateContext from "../../../../shared-module/contexts/LoginStateContext"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import GenericLoading from "../../../GenericLoading"

import ExerciseTask from "./ExerciseTask"

interface ExerciseBlockAttributes {
  id: string
}

// Special care taken here to ensure exercise content can have full width of
// the page.
const ExerciseBlock: React.FC<BlockRendererProps<ExerciseBlockAttributes>> = (props) => {
  const { t } = useTranslation()
  const loginState = useContext(LoginStateContext)
  const coursePageContext = useContext(CoursePageContext)
  const showExercise = props.isExam || (loginState.signedIn ? !!coursePageContext.settings : true)
  const [postThisStateToIFrame, dispatch] = useReducer(
    exerciseBlockPostThisStateToIFrameReducer,
    null,
  )

  const id = props.data.attributes.id
  // eslint-disable-next-line i18next/no-literal-string
  const queryUniqueKey = `exercise-${id}`
  const courseMaterialExercise = useQuery(queryUniqueKey, () => fetchExerciseById(id), {
    enabled: showExercise,
    onSuccess: (data) => {
      if (data.exercise_status?.score_given) {
        setPoints(data.exercise_status?.score_given)
      }
      dispatch({
        type: "exerciseDownloaded",
        payload: data,
      })
    },
  })

  const postSubmissionMutation = useMutation(postSubmission, {
    retry: 3,
    onSuccess: (data) => {
      if (data.grading) {
        setPoints(data.grading.score_given)
      }
      dispatch({
        type: "submissionGraded",
        payload: {
          submissionResult: data,
          publicSpec: courseMaterialExercise.data?.current_exercise_task.public_spec,
        },
      })
    },
  })
  const [answer, setAnswer] = useState<unknown>(null)
  const [answerValid, setAnswerValid] = useState(false)
  const [points, setPoints] = useState<number | null>(null)

  if (courseMaterialExercise.error) {
    return <pre>{JSON.stringify(courseMaterialExercise.error, undefined, 2)}</pre>
  }
  if (postSubmissionMutation.isError) {
    return <pre>{JSON.stringify(postSubmissionMutation.error, undefined, 2)}</pre>
  }

  if (!showExercise) {
    return <div>{t("please-select-course-instance-before-answering-exercise")}</div>
  }

  if (courseMaterialExercise.isLoading || !courseMaterialExercise.data) {
    return <GenericLoading />
  }

  const courseInstanceId = coursePageContext?.instance?.id

  const inEndedExam = coursePageContext?.exam?.ends_at
    ? coursePageContext?.exam?.ends_at < new Date()
    : false
  const noSubmission = courseMaterialExercise.data.previous_submission === null
  const cannotAnswerButNoSubmission = inEndedExam && noSubmission

  return (
    <div
      className={css`
        width: 100%;
        background: #f6f6f6;
        margin-bottom: 1rem;
        padding-top: 2rem;
      `}
      id={id}
    >
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
          display: flex;
          align-items: center;
          margin-bottom: 1.5rem;
        `}
      >
        <HelpIcon
          className={css`
            height: 5rem !important;
            width: 5rem !important;
            margin-right: 1rem;
          `}
        />
        <h2
          className={css`
            font-size: 2rem;
            font-weight: 400;
          `}
        >
          {courseMaterialExercise.data.exercise.name}
        </h2>
        <div
          className={css`
            flex: 1;
          `}
        />
        <div
          className={css`
            font-size: 1rem;
            text-align: center;
          `}
        >
          {t("points-label")}
          <br />
          {points ?? 0}/{courseMaterialExercise.data.exercise.score_maximum}
        </div>
      </div>
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
        `}
      >
        {postSubmissionMutation.data?.grading?.feedback_text &&
          postSubmissionMutation.data?.grading?.feedback_text}
      </div>
      <ExerciseTask
        exercise={courseMaterialExercise.data}
        postThisStateToIFrame={postThisStateToIFrame}
        setAnswer={setAnswer}
        setAnswerValid={setAnswerValid}
        cannotAnswerButNoSubmission={cannotAnswerButNoSubmission}
      />
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
          button {
            margin-bottom: 0.5rem;
          }
        `}
      >
        {!cannotAnswerButNoSubmission && postThisStateToIFrame?.view_type !== "view-submission" && (
          <Button
            size="medium"
            variant="primary"
            disabled={postSubmissionMutation.isLoading || !answerValid}
            onClick={() => {
              if (!courseInstanceId && !courseMaterialExercise.data.exercise.exam_id) {
                return
              }
              postSubmissionMutation.mutate({
                course_instance_id: courseInstanceId || null,
                exercise_task_id: courseMaterialExercise.data.current_exercise_task.id,

                data_json: answer,
              })
            }}
          >
            {t("submit-button")}
          </Button>
        )}
        {postThisStateToIFrame?.view_type === "view-submission" && (
          <Button
            variant="primary"
            size="medium"
            onClick={() => {
              dispatch({
                type: "tryAgain",
                payload: courseMaterialExercise.data,
              })
              postSubmissionMutation.reset()
              setAnswerValid(false)
            }}
            disabled={courseMaterialExercise.isRefetching}
          >
            {t("try-again")}
          </Button>
        )}
        {postSubmissionMutation.isError && <></>}
        <br />
        <DebugModal data={courseMaterialExercise.data} />
      </div>
    </div>
  )
}

export default withErrorBoundary(ExerciseBlock)
