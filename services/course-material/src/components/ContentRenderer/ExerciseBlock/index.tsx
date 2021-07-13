import { css } from "@emotion/css"
import { Button } from "@material-ui/core"
import HelpIcon from "@material-ui/icons/Help"
import { useContext, useState } from "react"
import { useQuery } from "react-query"

import ContentRenderer, { BlockRendererProps } from ".."
import CoursePageContext from "../../../contexts/CoursePageContext"
import {
  Block,
  fetchExerciseById,
  postSubmission,
  SubmissionResult,
} from "../../../services/backend"
import DebugModal from "../../../shared-module/components/DebugModal"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"
import { normalWidthCenteredComponentStyles } from "../../../styles/componentStyles"
import { defaultContainerWidth } from "../../../styles/constants"
import GenericLoading from "../../GenericLoading"

import ExerciseTaskIframe from "./ExerciseTaskIframe"

interface ExerciseBlockAttributes {
  id: string
}

// Special care taken here to ensure exercise content can have full width of
// the page.
const ExerciseBlock: React.FC<BlockRendererProps<ExerciseBlockAttributes>> = (props) => {
  const id = props.data.attributes.id
  const { isLoading, error, data } = useQuery(`exercise-${id}`, () => fetchExerciseById(id))
  const [answer, setAnswer] = useState<unknown>(null)
  const [submitting, setSubmitting] = useState(false)
  const coursePageContext = useContext(CoursePageContext)
  const [submissionResponse, setSubmissionResponse] = useState<SubmissionResult | null>(null)
  const [submissionError, setSubmissionError] = useState<string | null>(null)

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
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
        />
      ) : (
        "Don't know how to render this assignment"
      )}
      <div
        className={css`
          ${normalWidthCenteredComponentStyles}
          button {
            margin-bottom: 0.5rem;
          }
        `}
      >
        <Button
          disabled={submitting || !courseInstanceId}
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
            } catch (e) {
              console.error(e)
              setSubmissionResponse(null)
              setSubmissionError(e)
            } finally {
              setSubmitting(false)
            }
          }}
          color="primary"
          variant="contained"
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
