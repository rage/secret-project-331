import { css } from "@emotion/css"
import HelpIcon from "@material-ui/icons/Help"
import { useContext, useReducer, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { BlockRendererProps } from "../.."
import PageContext from "../../../../contexts/PageContext"
import exerciseBlockPostThisStateToIFrameReducer from "../../../../reducers/exerciseBlockPostThisStateToIFrameReducer"
import { fetchExerciseById, postSubmission } from "../../../../services/backend"
import { StudentExerciseSlideSubmission } from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"
import BreakFromCentered from "../../../../shared-module/components/Centering/BreakFromCentered"
import Centered from "../../../../shared-module/components/Centering/Centered"
import DebugModal from "../../../../shared-module/components/DebugModal"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import LoginStateContext from "../../../../shared-module/contexts/LoginStateContext"
import useToastMutation from "../../../../shared-module/hooks/useToastMutation"
import { IframeState } from "../../../../shared-module/iframe-protocol-types"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import ExerciseTask from "./ExerciseTask"

interface ExerciseBlockAttributes {
  id: string
}

// Special care taken here to ensure exercise content can have full width of
// the page.
const ExerciseBlock: React.FC<BlockRendererProps<ExerciseBlockAttributes>> = (props) => {
  const { t } = useTranslation()
  const loginState = useContext(LoginStateContext)
  const pageContext = useContext(PageContext)
  const showExercise = props.isExam || (loginState.signedIn ? !!pageContext.settings : true)
  const [postThisStateToIFrame, dispatch] = useReducer(
    exerciseBlockPostThisStateToIFrameReducer,
    null,
  )

  const id = props.data.attributes.id
  // eslint-disable-next-line i18next/no-literal-string
  const queryUniqueKey = `exercise-${id}`
  const getCourseMaterialExercise = useQuery(queryUniqueKey, () => fetchExerciseById(id), {
    enabled: showExercise,
    onSuccess: (data) => {
      if (data.exercise_status?.score_given) {
        setPoints(data.exercise_status?.score_given)
      }
      dispatch({
        type: "exerciseDownloaded",
        payload: data.current_exercise_slide.exercise_tasks,
      })
    },
  })

  const postSubmissionMutation = useToastMutation(
    (submission: StudentExerciseSlideSubmission) => postSubmission(id, submission),
    {
      notify: false,
    },
    {
      retry: 3,
      onSuccess: (data) => {
        if (data.exercise_status) {
          setPoints(data.exercise_status.score_given)
        }
        dispatch({
          type: "submissionGraded",
          payload: data,
        })
      },
    },
  )
  const [answers, setAnswers] = useState<Map<string, { valid: boolean; data: unknown }>>(new Map())
  const [points, setPoints] = useState<number | null>(null)

  if (!showExercise) {
    return <div>{t("please-select-course-instance-before-answering-exercise")}</div>
  }

  if (getCourseMaterialExercise.isError) {
    return <ErrorBanner variant={"readOnly"} error={getCourseMaterialExercise.error} />
  }
  if (getCourseMaterialExercise.isLoading || getCourseMaterialExercise.isIdle) {
    return <Spinner variant={"medium"} />
  }

  const courseInstanceId = pageContext?.instance?.id

  const inEndedExam = pageContext?.exam?.ends_at ? pageContext?.exam?.ends_at < new Date() : false
  const noSubmission = getCourseMaterialExercise.data.exercise_status === null

  const cannotAnswerButNoSubmission = inEndedExam && noSubmission

  return (
    <BreakFromCentered sidebar={false}>
      <div
        className={css`
          width: 100%;
          background: #f6f6f6;
          margin-bottom: 1rem;
          padding-top: 2rem;
        `}
        id={id}
      >
        <Centered variant="narrow">
          <div
            className={css`
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
              {getCourseMaterialExercise.data.exercise.name}
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
              {points ?? 0}/{getCourseMaterialExercise.data.exercise.score_maximum}
            </div>
          </div>
          <div>
            {postSubmissionMutation.data?.exercise_task_submission_results[0].grading
              ?.feedback_text &&
              postSubmissionMutation.data?.exercise_task_submission_results[0].grading
                ?.feedback_text}
          </div>
          {getCourseMaterialExercise.data.current_exercise_slide.exercise_tasks.map((task) => (
            <ExerciseTask
              key={task.id}
              exerciseTask={task}
              isExam={false}
              setAnswer={(answer) =>
                setAnswers((prev) => {
                  const answers = new Map(prev)
                  answers.set(task.id, answer)
                  return answers
                })
              }
              postThisStateToIFrame={
                postThisStateToIFrame?.find((x) => x.exercise_task_id === task.id) as IframeState
              }
              cannotAnswerButNoSubmission={cannotAnswerButNoSubmission}
            />
          ))}
          <div
            className={css`
              button {
                margin-bottom: 0.5rem;
              }
            `}
          >
            {!cannotAnswerButNoSubmission &&
              postThisStateToIFrame?.every((x) => x.view_type !== "view-submission") && (
                <Button
                  size="medium"
                  variant="primary"
                  disabled={
                    postSubmissionMutation.isLoading ||
                    answers.size === 0 ||
                    Array.from(answers.values()).some((x) => !x.valid)
                  }
                  onClick={() => {
                    if (!courseInstanceId && !getCourseMaterialExercise.data.exercise.exam_id) {
                      return
                    }
                    postSubmissionMutation.mutate({
                      exercise_slide_id: getCourseMaterialExercise.data.current_exercise_slide.id,
                      exercise_task_submissions:
                        getCourseMaterialExercise.data.current_exercise_slide.exercise_tasks.map(
                          (task) => ({
                            exercise_task_id: task.id,
                            data_json: answers.get(task.id)?.data,
                          }),
                        ),
                    })
                  }}
                >
                  {t("submit-button")}
                </Button>
              )}
            {/* These are now arrays so should be refactored */}
            {postThisStateToIFrame?.every((x) => x.view_type === "view-submission") && (
              <Button
                variant="primary"
                size="medium"
                onClick={() => {
                  dispatch({
                    type: "tryAgain",
                    payload: getCourseMaterialExercise.data.current_exercise_slide.exercise_tasks,
                  })
                  postSubmissionMutation.reset()
                  setAnswers(new Map())
                }}
                disabled={getCourseMaterialExercise.isRefetching}
              >
                {t("try-again")}
              </Button>
            )}
            {postSubmissionMutation.isError && (
              <ErrorBanner variant={"readOnly"} error={postSubmissionMutation.error} />
            )}
            <br />
            <DebugModal data={getCourseMaterialExercise.data} />
          </div>
        </Centered>
      </div>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(ExerciseBlock)
