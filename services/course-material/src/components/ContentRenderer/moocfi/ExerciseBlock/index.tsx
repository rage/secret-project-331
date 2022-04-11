import { css } from "@emotion/css"
import styled from "@emotion/styled"
import HelpIcon from "@mui/icons-material/Help"
import { useContext, useReducer, useState } from "react"
import { useTranslation } from "react-i18next"
import { useQuery, useQueryClient } from "react-query"

import { BlockRendererProps } from "../.."
import PageContext from "../../../../contexts/PageContext"
import exerciseBlockPostThisStateToIFrameReducer from "../../../../reducers/exerciseBlockPostThisStateToIFrameReducer"
import { fetchExerciseById, postSubmission } from "../../../../services/backend"
import {
  CourseMaterialExercise,
  StudentExerciseSlideSubmission,
} from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"
import BreakFromCentered from "../../../../shared-module/components/Centering/BreakFromCentered"
import Centered from "../../../../shared-module/components/Centering/Centered"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import LoginStateContext from "../../../../shared-module/contexts/LoginStateContext"
import useToastMutation from "../../../../shared-module/hooks/useToastMutation"
import { baseTheme } from "../../../../shared-module/styles"
import { dateDiffInDays } from "../../../../shared-module/utils/dateUtil"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import ExerciseTask from "./ExerciseTask"

interface ExerciseBlockAttributes {
  id: string
}

interface DeadlineProps {
  closingSoon: boolean
}

// eslint-disable-next-line i18next/no-literal-string
const DeadlineText = styled.div<DeadlineProps>`
  display: flex;
  justify-content: center;
  font-size: 16px;
  padding: 1rem;
  background: ${(DeadlineProps) =>
    DeadlineProps.closingSoon ? baseTheme.colors.red["100"] : baseTheme.colors.clear["300"]};
  color: ${(DeadlineProps) =>
    DeadlineProps.closingSoon ? baseTheme.colors.red["700"] : baseTheme.colors.green["600"]};
`

// Special care taken here to ensure exercise content can have full width of
// the page.
const ExerciseBlock: React.FC<BlockRendererProps<ExerciseBlockAttributes>> = (props) => {
  const [answers, setAnswers] = useState<Map<string, { valid: boolean; data: unknown }>>(new Map())
  const [points, setPoints] = useState<number | null>(null)
  const queryClient = useQueryClient()
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

  const isExam = !!pageContext.exam

  const spentTries =
    getCourseMaterialExercise.data.exercise_slide_submission_counts[
      getCourseMaterialExercise.data.current_exercise_slide.id
    ] ?? 0

  const maxTries = getCourseMaterialExercise.data.exercise.max_tries_per_slide

  const triesRemaining = maxTries && maxTries - spentTries

  const limit_number_of_tries = getCourseMaterialExercise.data.exercise.limit_number_of_tries
  const ranOutOfTries =
    limit_number_of_tries && maxTries !== null && triesRemaining !== null && triesRemaining <= 0

  const deadline = getCourseMaterialExercise.data.exercise.deadline

  const dateInTwoDays = new Date()
  dateInTwoDays.setDate(dateInTwoDays.getDate() + 2)

  return (
    <BreakFromCentered sidebar={false}>
      <div
        className={css`
          width: 100%;
          background: #f6f6f6;
          margin-bottom: 1rem;
          padding-top: 2rem;
          padding-bottom: 1rem;
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
            />{" "}
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
          {deadline &&
            (Date.now() < deadline.getTime() ? (
              <DeadlineText closingSoon={dateInTwoDays.getTime() >= deadline.getTime()}>
                {t("deadline")} {deadline.toUTCString()}
              </DeadlineText>
            ) : (
              <DeadlineText closingSoon={true}>
                {t("Deadline-passed-n-days-ago", { days: dateDiffInDays(deadline) })}
              </DeadlineText>
            ))}
          {getCourseMaterialExercise.data.current_exercise_slide.exercise_tasks.map((task) => (
            <ExerciseTask
              key={task.id}
              exerciseTask={task}
              isExam={isExam}
              setAnswer={(answer) =>
                setAnswers((prev) => {
                  const answers = new Map(prev)
                  answers.set(task.id, answer)
                  return answers
                })
              }
              postThisStateToIFrame={postThisStateToIFrame?.find(
                (x) => x.exercise_task_id === task.id,
              )}
              canPostSubmission={getCourseMaterialExercise.data.can_post_submission}
            />
          ))}
          <div
            className={css`
              button {
                margin-bottom: 0.5rem;
              }
            `}
          >
            {getCourseMaterialExercise.data.can_post_submission &&
              postThisStateToIFrame?.every((x) => x.view_type !== "view-submission") && (
                <Button
                  size="medium"
                  variant="primary"
                  disabled={
                    postSubmissionMutation.isLoading ||
                    answers.size < postThisStateToIFrame.length ||
                    Array.from(answers.values()).some((x) => !x.valid)
                  }
                  onClick={() => {
                    if (!courseInstanceId && !getCourseMaterialExercise.data.exercise.exam_id) {
                      return
                    }
                    postSubmissionMutation.mutate(
                      {
                        exercise_slide_id: getCourseMaterialExercise.data.current_exercise_slide.id,
                        exercise_task_submissions:
                          getCourseMaterialExercise.data.current_exercise_slide.exercise_tasks.map(
                            (task) => ({
                              exercise_task_id: task.id,
                              data_json: answers.get(task.id)?.data,
                            }),
                          ),
                      },
                      {
                        onSuccess: () => {
                          queryClient.setQueryData(queryUniqueKey, (old) => {
                            // Update slide submission counts without refetching
                            const oldData = old as CourseMaterialExercise
                            const oldSubmissionCounts =
                              oldData?.exercise_slide_submission_counts ?? {}
                            const slideId =
                              getCourseMaterialExercise?.data?.current_exercise_slide?.id
                            const newSubmissionCounts = { ...oldSubmissionCounts }
                            if (slideId) {
                              newSubmissionCounts[slideId] = (oldSubmissionCounts[slideId] ?? 0) + 1
                            }
                            return {
                              ...oldData,
                              exercise_slide_submission_counts: newSubmissionCounts,
                            }
                          })
                        },
                      },
                    )
                  }}
                >
                  {t("submit-button")}
                </Button>
              )}
            {/* These are now arrays so should be refactored */}
            {postThisStateToIFrame?.every((x) => x.view_type === "view-submission") &&
              !ranOutOfTries && (
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
                  disabled={
                    getCourseMaterialExercise.isRefetching ||
                    !getCourseMaterialExercise.data.can_post_submission
                  }
                >
                  {t("try-again")}
                </Button>
              )}
            {postSubmissionMutation.isError && (
              <ErrorBanner variant={"readOnly"} error={postSubmissionMutation.error} />
            )}
            {limit_number_of_tries && maxTries !== null && triesRemaining !== null && (
              <div
                className={css`
                  color: ${baseTheme.colors.grey[500]};
                `}
              >
                {t("tries-remaining-n", { n: triesRemaining })}
              </div>
            )}
          </div>
        </Centered>
      </div>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(ExerciseBlock)
