import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faQuestion as infoIcon } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { CheckCircle } from "@vectopus/atlas-icons-react"
import { produce } from "immer"
import { useContext, useEffect, useId, useReducer, useState } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."
import PageContext from "../../../../contexts/PageContext"
import exerciseBlockPostThisStateToIFrameReducer from "../../../../reducers/exerciseBlockPostThisStateToIFrameReducer"
import {
  fetchExerciseById,
  postStartPeerReview,
  postSubmission,
} from "../../../../services/backend"
import {
  CourseMaterialExercise,
  StudentExerciseSlideSubmission,
} from "../../../../shared-module/bindings"
import Button from "../../../../shared-module/components/Button"
import BreakFromCentered from "../../../../shared-module/components/Centering/BreakFromCentered"
import Centered from "../../../../shared-module/components/Centering/Centered"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import HideTextInSystemTests from "../../../../shared-module/components/system-tests/HideTextInSystemTests"
import LoginStateContext from "../../../../shared-module/contexts/LoginStateContext"
import useToastMutation from "../../../../shared-module/hooks/useToastMutation"
import { baseTheme, headingFont, secondaryFont } from "../../../../shared-module/styles"
import { dateDiffInDays } from "../../../../shared-module/utils/dateUtil"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import ExerciseTask from "./ExerciseTask"
import GradingState from "./GradingState"
import PeerReviewView from "./PeerReviewView"
import PeerReviewReceived from "./PeerReviewView/PeerReviewsReceivedComponent/index"
import WaitingForPeerReviews from "./PeerReviewView/WaitingForPeerReviews"

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
  font-size: clamp(10px, 2.5vw, 16px);
  padding: 1rem;
  background: ${(DeadlineProps) =>
    DeadlineProps.closingSoon ? baseTheme.colors.red["100"] : baseTheme.colors.clear["300"]};
  color: ${(DeadlineProps) =>
    DeadlineProps.closingSoon ? baseTheme.colors.red["700"] : baseTheme.colors.green["600"]};
`

export const getExerciseBlockBeginningScrollingId = (exerciseId: string) => exerciseId

// Special care taken here to ensure exercise content can have full width of
// the page.
const ExerciseBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ExerciseBlockAttributes>>
> = (props) => {
  const exerciseTitleId = useId()
  const [allowStartPeerReview, setAllowStartPeerReview] = useState(true)
  const [answers, setAnswers] = useState<Map<string, { valid: boolean; data: unknown }>>(new Map())
  const [points, setPoints] = useState<number | null>(null)
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation()
  const loginState = useContext(LoginStateContext)
  const pageContext = useContext(PageContext)
  const showExercise =
    Boolean(pageContext.exam?.id) || (loginState.signedIn ? !!pageContext.settings : true)
  const [postThisStateToIFrame, dispatch] = useReducer(
    exerciseBlockPostThisStateToIFrameReducer,
    null,
  )
  const userOnWrongLanguageVersion =
    pageContext.settings &&
    pageContext.settings.current_course_instance_id !== pageContext.instance?.id

  const id = props.data.attributes.id
  // eslint-disable-next-line i18next/no-literal-string
  const queryUniqueKey = [`exercise`, id]
  const getCourseMaterialExercise = useQuery({
    queryKey: queryUniqueKey,
    queryFn: () => fetchExerciseById(id),
    enabled: showExercise,
  })
  useEffect(() => {
    if (!getCourseMaterialExercise.data) {
      return
    }
    if (getCourseMaterialExercise.data.exercise_status?.score_given) {
      setPoints(getCourseMaterialExercise.data.exercise_status?.score_given)
    }
    dispatch({
      type: "exerciseDownloaded",
      payload: getCourseMaterialExercise.data,
      signedIn: Boolean(loginState.signedIn),
    })
    const a = new Map()
    getCourseMaterialExercise.data.current_exercise_slide.exercise_tasks.map((et) => {
      if (et.previous_submission) {
        a.set(et.id, { valid: true, data: et.previous_submission.data_json ?? null })
      }
    })
    setAnswers(a)
  }, [getCourseMaterialExercise.data, loginState.signedIn])

  const postSubmissionMutation = useToastMutation(
    (submission: StudentExerciseSlideSubmission) => postSubmission(id, submission),
    {
      notify: false,
    },
    {
      onSuccess: async (data) => {
        if (data.exercise_status) {
          setPoints(data.exercise_status.score_given)
        }
        dispatch({
          type: "submissionGraded",
          payload: data,
          signedIn: Boolean(loginState.signedIn),
        })
        await getCourseMaterialExercise.refetch()
      },
    },
  )

  const tryAgainMutation = useToastMutation(
    async () => {
      const data = getCourseMaterialExercise.data
      if (!data) {
        // eslint-disable-next-line i18next/no-literal-string
        throw new Error("No data for the try again view")
      }
      dispatch({
        type: "tryAgain",
        payload: data,
        signedIn: Boolean(loginState.signedIn),
      })
      postSubmissionMutation.reset()

      setAnswers(answers)

      // if answers were empty, because page refresh
      if (answers.size === 0 && pageContext.settings?.user_id) {
        await getCourseMaterialExercise.refetch()
        const a = new Map()
        getCourseMaterialExercise.data.current_exercise_slide.exercise_tasks.map((et) => {
          if (et.previous_submission) {
            a.set(et.id, { valid: true, data: et.previous_submission.data_json ?? null })
          }
        })
        setAnswers(a)
      }
    },
    {
      notify: false,
    },
  )

  if (!showExercise) {
    return <div>{t("please-select-course-instance-before-answering-exercise")}</div>
  }

  if (getCourseMaterialExercise.isError) {
    return <ErrorBanner variant={"readOnly"} error={getCourseMaterialExercise.error} />
  }
  if (getCourseMaterialExercise.isPending) {
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

  const exerciseDeadline = getCourseMaterialExercise.data.exercise.deadline

  const exerciseSlideSubmissionId =
    getCourseMaterialExercise.data.previous_exercise_slide_submission?.id

  const dateInTwoDays = new Date()
  dateInTwoDays.setDate(dateInTwoDays.getDate() + 2)

  const lang = i18n.language

  let deadlineAsString = ""
  const DATESTYLE = "long"
  const TIMESTYLE = "short"

  if (exerciseDeadline) {
    const sign = exerciseDeadline.getTimezoneOffset() > 0 ? "-" : "+"

    deadlineAsString = exerciseDeadline.toLocaleString(lang, {
      dateStyle: DATESTYLE,
      timeStyle: TIMESTYLE,
    })

    const timezoneOffsetParts = (-exerciseDeadline.getTimezoneOffset() / 60).toString().split(".")
    const start = timezoneOffsetParts[0].padStart(2, "0")
    let end = ""
    if (timezoneOffsetParts[1]) {
      end = timezoneOffsetParts[1].padEnd(2, "0")
    } else {
      end = end.padEnd(2, "0")
    }

    // eslint-disable-next-line i18next/no-literal-string
    const timezoneOffset = `(UTC${sign}${start}:${end})`
    deadlineAsString = deadlineAsString + ` ${timezoneOffset}`
  }

  // These are now arrays so should be refactored
  const inSubmissionView =
    postThisStateToIFrame?.every((x) => x.view_type === "view-submission") ?? false
  const needsPeerReview = getCourseMaterialExercise.data.exercise.needs_peer_review

  const reviewingStage = getCourseMaterialExercise.data.exercise_status?.reviewing_stage
  const gradingState = getCourseMaterialExercise.data.exercise_status?.grading_progress
  return (
    <BreakFromCentered sidebar={false}>
      {/* Exercises are so important part of the pages that we will use section to make it easy-to-find
      for screenreader users */}
      <section
        className={css`
          width: 100%;
          background: #fafafa;
          margin-bottom: 1rem;
          padding-bottom: 1rem;
        `}
        id={getExerciseBlockBeginningScrollingId(id)}
        aria-labelledby={exerciseTitleId}
      >
        <div>
          <Centered variant="narrow">
            <div
              className={css`
                display: flex;
                align-items: center;
                margin-bottom: 1.5rem;
                padding: 1.5rem 1.2rem;
                background: #215887;
                color: white;
              `}
            >
              <FontAwesomeIcon
                icon={infoIcon}
                className={css`
                  height: 2rem !important;
                  width: 2rem !important;
                  margin-right: 0.8rem;
                  background: #063157;
                  padding: 0.5rem;
                  border-radius: 50px;
                `}
              />
              <h2
                id={exerciseTitleId}
                className={css`
                  font-size: 1.7rem;
                  font-weight: 500;
                  font-family: ${headingFont} !important;
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                `}
              >
                <div
                  className={css`
                    font-weight: 500;
                    font-size: 19px;
                    line-height: 19px;
                  `}
                >
                  {t("label-exercise")}:
                </div>
                <div
                  className={css`
                    line-height: 31px;
                  `}
                >
                  {getCourseMaterialExercise.data.exercise.name}
                </div>
              </h2>
              <div
                className={css`
                  flex: 1;
                `}
              />
              <div
                className={css`
                  font-size: 1.2rem;
                  text-align: center;
                  font-family: ${secondaryFont} !important;
                `}
              >
                {isExam && points === null ? (
                  <>
                    {t("max-points")}: {getCourseMaterialExercise.data.exercise.score_maximum}
                  </>
                ) : (
                  <>
                    {t("points-label")}:
                    <br />
                    {points ?? 0}/{getCourseMaterialExercise.data.exercise.score_maximum}
                  </>
                )}
              </div>
            </div>
          </Centered>
        </div>
        <Centered variant="narrow">
          {exerciseDeadline &&
            (Date.now() < exerciseDeadline.getTime() ? (
              <DeadlineText closingSoon={dateInTwoDays.getTime() >= exerciseDeadline.getTime()}>
                {t("deadline")}
                <HideTextInSystemTests
                  text={deadlineAsString}
                  testPlaceholder="Time of the deadline"
                />
              </DeadlineText>
            ) : (
              <DeadlineText closingSoon={true}>
                {t("Deadline-passed-n-days-ago", { days: dateDiffInDays(exerciseDeadline) })}
              </DeadlineText>
            ))}

          {getCourseMaterialExercise.data.peer_review_config && gradingState && reviewingStage && (
            <GradingState
              gradingProgress={gradingState}
              reviewingStage={reviewingStage}
              peerReviewConfig={getCourseMaterialExercise.data.peer_review_config}
            />
          )}
          {/* Reviewing stage seems to be undefined at least for exams */}
          {reviewingStage !== "PeerReview" &&
            reviewingStage !== "SelfReview" &&
            getCourseMaterialExercise.data.current_exercise_slide.exercise_tasks
              .sort((a, b) => a.order_number - b.order_number)
              .map((task) => (
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
                  exerciseNumber={getCourseMaterialExercise.data.exercise.order_number}
                />
              ))}
          {reviewingStage === "PeerReview" && (
            <PeerReviewView
              exerciseNumber={getCourseMaterialExercise.data.exercise.order_number}
              exerciseId={id}
              parentExerciseQuery={getCourseMaterialExercise}
            />
          )}
          {reviewingStage === "WaitingForPeerReviews" && <WaitingForPeerReviews />}
          <div
            className={css`
              button {
                margin-bottom: 0.5rem;
              }
            `}
          >
            {getCourseMaterialExercise.data.can_post_submission &&
              !userOnWrongLanguageVersion &&
              !inSubmissionView && (
                <Button
                  size="medium"
                  variant="primary"
                  disabled={
                    postSubmissionMutation.isPending ||
                    answers.size < (postThisStateToIFrame?.length ?? 0) ||
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
                        onSuccess: (res) => {
                          queryClient.setQueryData(
                            queryUniqueKey,
                            (old: CourseMaterialExercise | undefined) => {
                              if (!old) {
                                // eslint-disable-next-line i18next/no-literal-string
                                throw new Error("No CourseMaterialExercise found")
                              }
                              return produce(old, (draft: CourseMaterialExercise) => {
                                res.exercise_task_submission_results.forEach(
                                  (et_submission_result) => {
                                    // Set previous submission so that it can be restored if the user tries the exercise again without reloading the page first
                                    const receivedExerciseTaskSubmission =
                                      et_submission_result.submission
                                    const draftExerciseTask =
                                      draft.current_exercise_slide.exercise_tasks.find((et) => {
                                        return (
                                          et.id === et_submission_result.submission.exercise_task_id
                                        )
                                      })
                                    if (draftExerciseTask) {
                                      draftExerciseTask.previous_submission =
                                        receivedExerciseTaskSubmission
                                    }
                                    // Additional check to make sure we're not accidentally leaking gradings in exams from this endpoint
                                    if (isExam && et_submission_result.grading !== null) {
                                      // eslint-disable-next-line i18next/no-literal-string
                                      throw new Error("Exams should have hidden gradings")
                                    }
                                  },
                                )
                              })
                            },
                          )
                        },
                      },
                    )
                  }}
                >
                  {t("submit-button")}
                </Button>
              )}
            {inSubmissionView &&
              getCourseMaterialExercise.data.exercise.needs_peer_review &&
              exerciseSlideSubmissionId &&
              (reviewingStage === "WaitingForPeerReviews" ||
                reviewingStage === "ReviewedAndLocked") && (
                <PeerReviewReceived id={id} submissionId={exerciseSlideSubmissionId} />
              )}
            {inSubmissionView &&
              (reviewingStage === "NotStarted" || reviewingStage === undefined) && (
                <div>
                  {isExam && (
                    <div
                      className={css`
                        background-color: ${baseTheme.colors.green[100]};
                        color: ${baseTheme.colors.green[700]};
                        padding: 0.7rem 1rem;
                        margin: 1rem 0;
                        border: 1px solid ${baseTheme.colors.green[300]};
                        display: flex;
                        align-items: center;

                        svg {
                          width: 80px;
                          margin-right: 1rem;
                        }
                      `}
                    >
                      <CheckCircle size={30} />

                      <div>{t("exam-submission-has-been-saved-help-text")}</div>
                    </div>
                  )}
                  {!ranOutOfTries && (
                    <Button
                      variant="primary"
                      size="medium"
                      onClick={() => {
                        tryAgainMutation.mutate()
                      }}
                      disabled={
                        getCourseMaterialExercise.isRefetching ||
                        !getCourseMaterialExercise.data.can_post_submission ||
                        tryAgainMutation.isPending
                      }
                    >
                      {t("try-again")}
                    </Button>
                  )}
                  {needsPeerReview && (
                    <Button
                      variant="primary"
                      size="medium"
                      disabled={!needsPeerReview || !allowStartPeerReview}
                      onClick={async () => {
                        setAllowStartPeerReview(false)
                        await postStartPeerReview(id).finally(() => setAllowStartPeerReview(true))
                        await getCourseMaterialExercise.refetch()
                      }}
                    >
                      {t("start-peer-review")}
                    </Button>
                  )}
                </div>
              )}
            {postSubmissionMutation.isError && (
              <ErrorBanner variant={"readOnly"} error={postSubmissionMutation.error} />
            )}
            {limit_number_of_tries && maxTries !== null && triesRemaining !== null && (
              <div
                className={css`
                  color: ${baseTheme.colors.gray[500]};
                `}
              >
                {t("tries-remaining-n", { n: triesRemaining })}
              </div>
            )}
            {!loginState.isPending && !loginState.signedIn && (
              <div>{t("please-log-in-to-answer-exercise")}</div>
            )}
          </div>
        </Centered>
      </section>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(ExerciseBlock)
