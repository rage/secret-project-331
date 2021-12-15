import { css } from "@emotion/css"
import HelpIcon from "@material-ui/icons/Help"
import { useContext, useReducer, useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation, useQuery } from "react-query"

import ContentRenderer, { BlockRendererProps } from "../.."
import CoursePageContext from "../../../../contexts/CoursePageContext"
import exerciseBlockPostThisStateToIFrameReducer from "../../../../reducers/exerciseBlockPostThisStateToIFrameReducer"
import { Block, fetchExerciseById, postSubmission } from "../../../../services/backend"
import Button from "../../../../shared-module/components/Button"
import DebugModal from "../../../../shared-module/components/DebugModal"
import LoginStateContext from "../../../../shared-module/contexts/LoginStateContext"
import { normalWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import { defaultContainerWidth } from "../../../../shared-module/styles/constants"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"
import GenericLoading from "../../../GenericLoading"

import ExerciseTaskIframe from "./ExerciseTaskIframe"

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
  const exerciseTask = useQuery(queryUniqueKey, () => fetchExerciseById(id), {
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
          publicSpec: exerciseTask.data?.current_exercise_task.public_spec,
        },
      })
    },
  })
  const [answer, setAnswer] = useState<unknown>(null)
  const [answerValid, setAnswerValid] = useState(false)
  const [points, setPoints] = useState<number | null>(null)

  if (exerciseTask.error) {
    return <pre>{JSON.stringify(exerciseTask.error, undefined, 2)}</pre>
  }
  if (postSubmissionMutation.isError) {
    return <pre>{JSON.stringify(postSubmissionMutation.error, undefined, 2)}</pre>
  }

  if (!showExercise) {
    return <div>{t("please-select-course-instance-before-answering-exercise")}</div>
  }

  if (exerciseTask.isLoading || !exerciseTask.data) {
    return <GenericLoading />
  }

  const url = exerciseTask.data.current_exercise_task_service_info?.exercise_iframe_url

  const currentExerciseTaskAssignment = exerciseTask.data.current_exercise_task
    .assignment as unknown as Block<unknown>[]

  const courseInstanceId = coursePageContext?.instance?.id

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
          {exerciseTask.data.exercise.name}
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
          {points ?? 0}/{exerciseTask.data.exercise.score_maximum}
        </div>
      </div>
      {currentExerciseTaskAssignment && (
        <ContentRenderer
          data={currentExerciseTaskAssignment}
          editing={false}
          selectedBlockId={null}
          setEdits={(map) => map}
          isExam={props.isExam}
        />
      )}
      {url ? (
        <ExerciseTaskIframe
          postThisStateToIFrame={postThisStateToIFrame}
          url={`${url}?width=${defaultContainerWidth}`}
          setAnswer={setAnswer}
          setAnswerValid={setAnswerValid}
        />
      ) : (
        t("dont-know-how-to-render-this-assignment")
      )}
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
          button {
            margin-bottom: 0.5rem;
          }
        `}
      >
        {postThisStateToIFrame?.view_type !== "view-submission" && (
          <Button
            size="medium"
            variant="primary"
            disabled={postSubmissionMutation.isLoading || !answerValid}
            onClick={() => {
              if (!courseInstanceId && !exerciseTask.data.exercise.exam_id) {
                return
              }
              postSubmissionMutation.mutate({
                course_instance_id: courseInstanceId || null,
                exercise_task_id: exerciseTask.data.current_exercise_task.id,

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
                payload: exerciseTask.data,
              })
              //exerciseTask.refetch()
              postSubmissionMutation.reset()
              setAnswerValid(false)
            }}
            disabled={exerciseTask.isRefetching}
          >
            {t("try-again")}
          </Button>
        )}
        {postSubmissionMutation.isError && <></>}
        <br />
        <DebugModal data={exerciseTask.data} />
      </div>
    </div>
  )
}

export default withErrorBoundary(ExerciseBlock)
