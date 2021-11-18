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
import { courseMaterialCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
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
  const showExercise = loginState.signedIn ? !!coursePageContext.settings : true
  const [postThisStateToIFrame, dispatch] = useReducer(exerciseBlockPostThisStateToIFrameReducer, {
    // eslint-disable-next-line i18next/no-literal-string
    view_type: "exercise",
    data: null,
  })

  const id = props.data.attributes.id
  // eslint-disable-next-line i18next/no-literal-string
  const queryUniqueKey = `exercise-${id}`
  const exerciseTask = useQuery(queryUniqueKey, () => fetchExerciseById(id), {
    enabled: showExercise,
    onSuccess: (data) => {
      dispatch({ type: "exerciseDownloaded", payload: { view_type: "exercise", data: data } })
    },
  })
  const postSubmissionMutation = useMutation(postSubmission, {
    retry: 3,
    onSuccess: (data) =>
      dispatch({ type: "submissionGraded", payload: { view_type: "view-submission", data: data } }),
  })
  const [answer, setAnswer] = useState<unknown>(null)
  const [answerValid, setAnswerValid] = useState(false)

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
          ${courseMaterialCenteredComponentStyles}
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
          {exerciseTask.data.exercise_status?.score_given ?? 0}/
          {exerciseTask.data.exercise.score_maximum}
        </div>
      </div>
      {currentExerciseTaskAssignment && (
        <ContentRenderer
          data={currentExerciseTaskAssignment}
          editing={false}
          selectedBlockId={null}
          setEdits={(map) => map}
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
          ${courseMaterialCenteredComponentStyles}
          button {
            margin-bottom: 0.5rem;
          }
        `}
      >
        {!postSubmissionMutation.isSuccess && (
          <Button
            size="medium"
            variant="primary"
            disabled={postSubmissionMutation.isLoading || !courseInstanceId || !answerValid}
            onClick={() => {
              if (!courseInstanceId) {
                return
              }
              postSubmissionMutation.mutate({
                course_instance_id: courseInstanceId,
                exercise_task_id: exerciseTask.data.current_exercise_task.id,
                data_json: answer,
              })
            }}
          >
            {t("submit-button")}
          </Button>
        )}
        {postSubmissionMutation.isSuccess && (
          <Button
            variant="primary"
            size="medium"
            onClick={() => {
              dispatch({
                type: "showExercise",
                payload: { view_type: "exercise", data: exerciseTask.data },
              })
              postSubmissionMutation.reset()
              setAnswerValid(false)
            }}
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
