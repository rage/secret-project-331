import { css } from "@emotion/css"
import HelpIcon from "@material-ui/icons/Help"
import { useContext, useState } from "react"
import { useQuery, useQueryClient } from "react-query"

import ContentRenderer, { BlockRendererProps } from ".."
import CoursePageContext from "../../../contexts/CoursePageContext"
import { Block, fetchExerciseById, postSubmission } from "../../../services/backend"
import { SubmissionResult } from "../../../shared-module/bindings"
import Button from "../../../shared-module/components/Button"
import DebugModal from "../../../shared-module/components/DebugModal"
import LoginStateContext from "../../../shared-module/contexts/LoginStateContext"
import { courseMaterialCenteredComponentStyles } from "../../../shared-module/styles/componentStyles"
import { defaultContainerWidth } from "../../../shared-module/styles/constants"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import GenericLoading from "../../GenericLoading"

import ExerciseTaskIframe from "./ExerciseTaskIframe"

interface ExerciseBlockAttributes {
  id: string
}

// Special care taken here to ensure exercise content can have full width of
// the page.
const ExerciseBlock: React.FC<BlockRendererProps<ExerciseBlockAttributes>> = (props) => {
  const loginState = useContext(LoginStateContext)
  const coursePageContext = useContext(CoursePageContext)
  const showExercise = loginState.signedIn ? !!coursePageContext.settings : true

  const id = props.data.attributes.id
  const queryUniqueKey = `exercise-${id}`
  const { isLoading, error, data } = useQuery(queryUniqueKey, () => fetchExerciseById(id), {
    enabled: showExercise,
  })
  const [answer, setAnswer] = useState<unknown>(null)
  const [answerValid, setAnswerValid] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submissionResponse, setSubmissionResponse] = useState<SubmissionResult | null>(null)
  const [submissionError, setSubmissionError] = useState<unknown | null>(null)
  const queryClient = useQueryClient()

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (!showExercise) {
    return <div>Please select a course instance before anwering this exercise.</div>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  const url = data.current_exercise_task_service_info?.exercise_iframe_url

  const currentExerciseTaskAssignment = data.current_exercise_task
    .assignment as unknown as Block<unknown>[]

  const courseInstanceId = coursePageContext?.instance?.id

  const feedbackText = submissionResponse?.grading?.feedback_text

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
          {data.exercise.name}
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
          Points:
          <br />
          {data.exercise_status?.score_given ?? 0}/{data.exercise.score_maximum}
        </div>
      </div>
      {currentExerciseTaskAssignment && <ContentRenderer data={currentExerciseTaskAssignment} />}
      {url ? (
        <ExerciseTaskIframe
          public_spec={data.current_exercise_task.public_spec}
          url={`${url}?width=${defaultContainerWidth}`}
          setAnswer={setAnswer}
          setAnswerValid={setAnswerValid}
        />
      ) : (
        "Don't know how to render this assignment"
      )}
      <div
        className={css`
          ${courseMaterialCenteredComponentStyles}
          button {
            margin-bottom: 0.5rem;
          }
        `}
      >
        <Button
          size="medium"
          variant="primary"
          disabled={submitting || !courseInstanceId || !answerValid}
          onClick={async () => {
            if (!courseInstanceId) {
              console.error("Tried to submit without a current course instance id")
              return
            }
            try {
              setSubmitting(true)
              setSubmissionResponse(null)
              setSubmissionError(null)
              const res = await postSubmission({
                exercise_task_id: data.current_exercise_task.id,
                course_instance_id: courseInstanceId,
                data_json: answer,
              })
              setSubmitting(false)
              setSubmissionResponse(res)
              const scoreGiven = res.grading.score_given ?? 0
              const newData = { ...data }
              if (newData.exercise_status) {
                newData.exercise_status.score_given = scoreGiven
                queryClient.setQueryData(queryUniqueKey, newData)
              }
            } catch (e: unknown) {
              console.error(e)
              setSubmissionResponse(null)
              if (e instanceof Error) {
                setSubmissionError(e.toString())
              } else {
                setSubmissionError("Submission failed")
              }
            } finally {
              setSubmitting(false)
            }
          }}
        >
          Submit
        </Button>
        {feedbackText && <p>{feedbackText}</p>}
        {submissionResponse && <pre>{JSON.stringify(submissionResponse, undefined, 2)}</pre>}
        {submissionError && <pre>{JSON.stringify(submissionError, undefined, 2)}</pre>}
        <br />
        <DebugModal data={data} />
      </div>
    </div>
  )
}

export default withErrorBoundary(ExerciseBlock)
