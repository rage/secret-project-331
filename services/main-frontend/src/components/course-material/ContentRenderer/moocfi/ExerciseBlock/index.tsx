"use client"

import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { useQueryClient } from "@tanstack/react-query"
import { CheckCircle, Padlock } from "@vectopus/atlas-icons-react"
import { useAtomValue } from "jotai"
import { uniqBy } from "lodash"
import { usePathname, useSearchParams } from "next/navigation"
import { useContext, useEffect, useId, useReducer, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import UserOnWrongCourseNotification from "@/components/course-material/notifications/UserOnWrongCourseNotification"
import YellowBox from "@/components/course-material/YellowBox"
import {
  ExerciseCardHeader,
  ExerciseCardTitle,
  ExerciseCardPointsBadge,
  ExerciseCardTriesBadge,
  ExerciseCardWrapper,
} from "@/components/exercise-card"
import { exerciseCardPillShell } from "@/components/exercise-card/exerciseCardPillShell"
import {
  postStartPeerOrSelfReview,
  postSubmission,
} from "@/generated/course-material-api/sdk.generated"
import type {
  CourseMaterialExerciseTask,
  StudentExerciseSlideSubmission,
} from "@/generated/course-material-api/types.generated"
import useCourseMaterialExerciseQuery, {
  courseMaterialExerciseQueryKey,
  isGradingPending,
} from "@/hooks/course-material/useCourseMaterialExerciseQuery"
import { useUserChapterLocks } from "@/hooks/course-material/useUserChapterLocks"
import exerciseBlockPostThisStateToIFrameReducer from "@/reducers/course-material/exerciseBlockPostThisStateToIFrameReducer"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { useDateStringAsDateNullable } from "@/shared-module/common/hooks/useDateStringAsDate"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { dateDiffInDays } from "@/shared-module/common/utils/dateUtil"
import { useCurrentPagePathForReturnTo } from "@/shared-module/common/utils/redirectBackAfterLoginOrSignup"
import { loginRoute, signUpRoute } from "@/shared-module/common/utils/routes"
import { dateToString } from "@/shared-module/common/utils/time"
import { storedAnswerToCapturedAnswerFields } from "@/shared-module/common/utils/typeMappter"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
import { QueryResult, ErrorNotice } from "@/shared-module/components"
import type { IframeConnectionState } from "@/shared-module/exercise-iframe-host/MessageChannelIFrame"
import { courseMaterialAtom } from "@/state/course-material"
import {
  type CapturedExerciseTaskAnswer,
  capturedAnswerToTaskSubmission,
} from "@/utils/course-material/exerciseTaskAnswer"

import type { BlockRendererProps } from "../.."
import ExerciseStatusMessage from "./ExerciseStatusMessage"
import ExerciseSubmitButton, { type SubmissionBlocker } from "./ExerciseSubmitButton"
import ExerciseTask, { type ExerciseTaskHandle, showsExerciseTaskIframe } from "./ExerciseTask"
import { focusHeadingAndAnnounce } from "./focusHeadingAndAnnounce"
import OutOfTriesNotification from "./OutOfTriesNotification"
import PeerOrSelfReviewView from "./PeerOrSelfReviewView"
import PeerOrSelfReviewsReceived from "./PeerOrSelfReviewView/PeerOrSelfReviewsReceivedComponent/index"
import WaitingForPeerReviews from "./PeerOrSelfReviewView/WaitingForPeerReviews"
import { getSubmissionScore } from "./submissionScore"

interface ExerciseBlockAttributes {
  id: string
}

interface DeadlineProps {
  closingSoon: boolean
}

const AWithNoDecoration = styled.a`
  text-decoration: none;
`

export const exerciseButtonStyles = css`
  align-items: center;
  appearance: none;
  background-color: #77c299;
  border-radius: 10px;
  border: none;
  max-width: 20rem;
  width: 100%;
  box-shadow:
    rgba(45, 35, 66, 0) 0 2px 4px,
    rgba(45, 35, 66, 0) 0 7px 13px -3px,
    #69af8a 0 -3px 0 inset;
  color: #313b49;
  font-weight: medium;
  cursor: pointer;
  display: flex;
  min-height: 48px;
  justify-content: center;
  line-height: 1;
  list-style: none;
  padding-left: 14px;
  padding-right: 14px;
  text-align: left;
  text-decoration: none;
  transition:
    box-shadow 0.15s,
    transform 0.15s;
  user-select: none;
  -webkit-user-select: none;
  touch-action: manipulation;
  white-space: nowrap;
  will-change: box-shadow, transform;
  font-size: 18px;
  margin: 0 auto;

  &:hover {
    filter: brightness(92%) contrast(110%);
    box-shadow:
      rgba(45, 35, 66, 0) 0 4px 8px,
      rgba(45, 35, 66, 0) 0 7px 13px -3px,
      #69af8a 0 -3px 0 inset;
  }

  &:disabled,
  &[aria-disabled="true"] {
    background: #929896;
    box-shadow:
      rgba(45, 35, 66, 0) 0 4px 8px,
      rgba(45, 35, 66, 0) 0 7px 13px -3px,
      #68716c 0 -3px 0 inset;
    cursor: not-allowed;
  }

  &[aria-disabled="true"]:hover {
    filter: none;
  }
`

export const makeExerciseButtonMutedStyles = css`
  margin-bottom: 1rem;
  margin-top: 1rem;
  background-color: ${baseTheme.colors.gray[100]};
  box-shadow:
    rgba(45, 35, 66, 0) 0 4px 8px,
    rgba(45, 35, 66, 0) 0 7px 13px -3px,
    ${baseTheme.colors.gray[200]} 0 -3px 0 inset !important;
`

const DeadlineText = styled.div<DeadlineProps>`
  display: flex;
  justify-content: center;
  font-size: 1rem;
  padding: 1rem;
  border-radius: 0.25rem;
  margin-bottom: 0.625rem;
  line-height: 140%;
  background: ${(DeadlineProps) =>
    DeadlineProps.closingSoon ? baseTheme.colors.red["100"] : baseTheme.colors.clear["300"]};
  color: ${(DeadlineProps) =>
    DeadlineProps.closingSoon ? baseTheme.colors.red["700"] : baseTheme.colors.green["600"]};
`

export const getExerciseBlockBeginningScrollingId = (exerciseId: string) => exerciseId

type CapturedAnswers = Map<string, CapturedExerciseTaskAnswer>

/**
 * Seeds answers from the tasks' previous submissions, keeping answers the iframes reported since:
 * a refetch doesn't re-send state to the iframes, so they wouldn't report them again. A task in
 * `changedSubmissionTaskIds` (its previous submission was replaced or removed, e.g. by a reset)
 * drops its captured answer, since its iframe is sent a new state.
 */
function mergePreviousSubmissionAnswers(
  answers: CapturedAnswers,
  tasks: CourseMaterialExerciseTask[],
  changedSubmissionTaskIds: ReadonlySet<string>,
): CapturedAnswers {
  const merged: CapturedAnswers = new Map()
  for (const task of tasks) {
    const captured = changedSubmissionTaskIds.has(task.id) ? undefined : answers.get(task.id)
    if (captured) {
      merged.set(task.id, captured)
    } else if (task.previous_submission) {
      merged.set(task.id, {
        valid: true,
        ...storedAnswerToCapturedAnswerFields(task.previous_submission),
      })
    }
  }
  return merged
}

// Special care taken here to ensure exercise content can have full width of
// the page.
const ExerciseBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ExerciseBlockAttributes>>
> = (props) => {
  const sectionRef = useRef<HTMLElement>(null)
  const exerciseTitleRef = useRef<HTMLHeadingElement>(null)
  const exerciseTitleId = useId()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const returnTo = useCurrentPagePathForReturnTo(
    pathname + (searchParams.toString() ? `?${searchParams.toString()}` : ""),
  )
  const queryClient = useQueryClient()
  const [answers, setAnswers] = useState<CapturedAnswers>(new Map())
  const previousSubmissionIdsRef = useRef<Map<string, string>>(new Map())
  const [connectionStatuses, setConnectionStatuses] = useState<
    Map<string, IframeConnectionState["status"]>
  >(new Map())
  const taskHandlesRef = useRef<Map<string, ExerciseTaskHandle>>(new Map())
  const [points, setPoints] = useState<number | null>(null)
  const { t } = useTranslation()
  const loginState = useContext(LoginStateContext)
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const showExercise =
    Boolean(courseMaterialState.examData?.id) ||
    courseMaterialState.status === "loading" ||
    (loginState.signedIn ? !!courseMaterialState.settings : true)
  const [postThisStateToIFrame, dispatch] = useReducer(
    exerciseBlockPostThisStateToIFrameReducer,
    null,
  )
  const userOnWrongLanguageVersion =
    courseMaterialState.settings &&
    courseMaterialState.settings.current_course_instance_id !== courseMaterialState.instance?.id

  const id = props.data.attributes.id
  const getCourseMaterialExercise = useCourseMaterialExerciseQuery(
    id,
    showExercise,
    postThisStateToIFrame?.every((state) => state.view_type === "view-submission") ?? false,
  )
  const courseId =
    courseMaterialState.status === "ready" ? (courseMaterialState.course?.id ?? null) : null
  const getUserLocks = useUserChapterLocks(courseId)

  const chapterId = getCourseMaterialExercise.data?.exercise.chapter_id
  const course = courseMaterialState.course
  const chapterLockingEnabled = course?.chapter_locking_enabled ?? false
  useEffect(() => {
    if (!getCourseMaterialExercise.data) {
      return
    }
    if (getCourseMaterialExercise.data.exercise_status?.score_given !== undefined) {
      setPoints(getCourseMaterialExercise.data.exercise_status?.score_given ?? null)
    }
    const exerciseChapterId = getCourseMaterialExercise.data.exercise.chapter_id
    const chapterStatus = exerciseChapterId
      ? getUserLocks.data?.find((status) => status.chapter_id === exerciseChapterId)
      : null
    const isChapterLocked =
      exerciseChapterId &&
      (chapterStatus?.status === "completed_and_locked" ||
        chapterStatus?.status === "not_unlocked_yet")
    dispatch({
      type: "exerciseDownloaded",
      payload: getCourseMaterialExercise.data,
      signedIn: Boolean(loginState.signedIn),
      isChapterLocked: Boolean(isChapterLocked),
    })
    const tasks = getCourseMaterialExercise.data.current_exercise_slide.exercise_tasks
    const seenSubmissionIds = previousSubmissionIdsRef.current
    const changedSubmissionTaskIds = new Set(
      tasks
        .filter((task) => seenSubmissionIds.get(task.id) !== task.previous_submission?.id)
        .map((task) => task.id),
    )
    previousSubmissionIdsRef.current = new Map(
      tasks.flatMap((task) =>
        task.previous_submission ? [[task.id, task.previous_submission.id] as const] : [],
      ),
    )
    setAnswers((prev) => mergePreviousSubmissionAnswers(prev, tasks, changedSubmissionTaskIds))
  }, [getCourseMaterialExercise.data, loginState.signedIn, getUserLocks.data])

  const postSubmissionMutation = useToastMutation(
    (submission: StudentExerciseSlideSubmission) =>
      postSubmission({
        path: {
          exercise_id: id,
        },
        body: submission,
      }),
    {
      notify: false,
    },
    {
      onSuccess: async (data) => {
        if (data.exercise_status) {
          setPoints(data.exercise_status.score_given ?? null)
        }
        dispatch({
          type: "submissionGraded",
          payload: data,
          signedIn: Boolean(loginState.signedIn),
        })
        // Announce grading to screen readers and move focus to the exercise heading.
        const scoreGiven = getSubmissionScore(data)
        const maxScore = getCourseMaterialExercise.data?.exercise.score_maximum
        focusHeadingAndAnnounce(
          exerciseTitleRef.current,
          scoreGiven !== null &&
            scoreGiven !== undefined &&
            maxScore !== null &&
            maxScore !== undefined
            ? t("answer-submitted-with-points-announcement", {
                points: scoreGiven,
                maxPoints: maxScore,
              })
            : t("answer-submitted-announcement"),
        )
        await getCourseMaterialExercise.refetch()
        makeSureComponentStaysVisibleAfterChangingView(sectionRef)
      },
    },
  )

  const tryAgainMutation = useToastMutation(
    async () => {
      const data = getCourseMaterialExercise.data
      if (!data) {
        throw new Error("No data for the try again view")
      }
      const exerciseChapterId = data.exercise.chapter_id
      const chapterStatus = exerciseChapterId
        ? getUserLocks.data?.find((status) => status.chapter_id === exerciseChapterId)
        : null
      const isChapterLocked =
        exerciseChapterId &&
        chapterLockingEnabled &&
        (chapterStatus?.status === "completed_and_locked" ||
          chapterStatus?.status === "not_unlocked_yet")
      // Try again is enabled during a pending-grading poll; a poll landing after it would put the
      // previous submission's view back.
      await queryClient.cancelQueries({ queryKey: courseMaterialExerciseQueryKey(id) })
      makeSureComponentStaysVisibleAfterChangingView(sectionRef)
      dispatch({
        type: "tryAgain",
        payload: data,
        signedIn: Boolean(loginState.signedIn),
        isChapterLocked: Boolean(isChapterLocked),
      })
      postSubmissionMutation.reset()

      setAnswers(answers)

      // if answers were empty, because page refresh
      if (answers.size === 0 && courseMaterialState.settings?.user_id) {
        const refetched = await getCourseMaterialExercise.refetch()
        const tasks = (refetched.data ?? data).current_exercise_slide.exercise_tasks
        setAnswers((prev) => mergePreviousSubmissionAnswers(prev, tasks, new Set()))
      }
      makeSureComponentStaysVisibleAfterChangingView(sectionRef)
    },
    {
      notify: false,
    },
    {
      onSuccess: () => {
        exerciseTitleRef.current?.focus({ preventScroll: true })
      },
    },
  )
  const exerciseDeadline = useDateStringAsDateNullable(
    getCourseMaterialExercise.data?.exercise.deadline,
  )

  // submissionBlockers below is only recomputed on render, so without this the submit button
  // would stay clickable past the deadline until something else happens to re-render the page.
  const [, forceRerenderAtDeadline] = useState(0)
  useEffect(() => {
    if (!exerciseDeadline) {
      return
    }
    const msUntilDeadline = exerciseDeadline.getTime() - Date.now()
    if (msUntilDeadline <= 0) {
      return
    }
    // setTimeout's delay is a 32-bit int, so deadlines more than ~24.8 days out are scheduled
    // in MAX_TIMEOUT_MS hops, recomputing the remaining time from Date.now() each hop, until
    // the real deadline is within range.
    const MAX_TIMEOUT_MS = 2 ** 31 - 1
    let timeoutId: ReturnType<typeof setTimeout>
    const scheduleCheck = () => {
      const remainingMs = exerciseDeadline.getTime() - Date.now()
      if (remainingMs <= 0) {
        forceRerenderAtDeadline((c) => c + 1)
        return
      }
      timeoutId = setTimeout(scheduleCheck, Math.min(remainingMs, MAX_TIMEOUT_MS))
    }
    timeoutId = setTimeout(scheduleCheck, Math.min(msUntilDeadline, MAX_TIMEOUT_MS))
    return () => clearTimeout(timeoutId)
  }, [exerciseDeadline])

  const startPeerOrSelfReviewMutation = useToastMutation(
    () =>
      postStartPeerOrSelfReview({
        path: {
          exercise_id: id,
        },
      }),
    { notify: false },
    {
      onSuccess: async () => {
        await getCourseMaterialExercise.refetch()
      },
    },
  )

  if (!showExercise) {
    return <div>{t("please-select-course-instance-before-answering-exercise")}</div>
  }

  return (
    <QueryResult
      query={getCourseMaterialExercise}
      emptyFallback={
        <div>
          <ErrorNotice error={t("error-loading-exercise")} />
          <button
            className={cx(exerciseButtonStyles)}
            onClick={() => {
              void getCourseMaterialExercise.refetch()
            }}
          >
            {t("button-text-try-again")}
          </button>
        </div>
      }
    >
      {(courseMaterialExercise) => {
        const courseInstanceId = courseMaterialState.instance?.id
        const chapterStatus = chapterId
          ? getUserLocks.data?.find((status) => status.chapter_id === chapterId)
          : null
        const isChapterCompleted =
          chapterId && chapterLockingEnabled && chapterStatus?.status === "completed_and_locked"
        const isChapterNotAccessible =
          chapterId && chapterLockingEnabled && chapterStatus?.status === "not_unlocked_yet"
        const isChapterLocked = isChapterCompleted || isChapterNotAccessible

        const isExam = !!courseMaterialState.examData

        const spentTries =
          courseMaterialExercise.exercise_slide_submission_counts[
            courseMaterialExercise.current_exercise_slide.id
          ] ?? 0

        const maxTries = courseMaterialExercise.exercise.max_tries_per_slide
        const triesRemaining =
          maxTries === null || maxTries === undefined ? null : maxTries - spentTries

        const limit_number_of_tries = courseMaterialExercise.exercise.limit_number_of_tries
        const ranOutOfTries =
          limit_number_of_tries &&
          maxTries !== null &&
          maxTries !== undefined &&
          triesRemaining !== null &&
          triesRemaining <= 0

        const exerciseSlideSubmissionId =
          courseMaterialExercise.previous_exercise_slide_submission?.id

        const dateInTwoDays = new Date()
        dateInTwoDays.setDate(dateInTwoDays.getDate() + 2)

        const deadlineAsString = exerciseDeadline ? dateToString(exerciseDeadline) : ""

        // These are now arrays so should be refactored
        const inSubmissionView =
          postThisStateToIFrame?.every((x) => x.view_type === "view-submission") ?? false
        const needsPeerReview = courseMaterialExercise.exercise.needs_peer_review
        const needsSelfReview = courseMaterialExercise.exercise.needs_self_review

        const reviewingStage = courseMaterialExercise.exercise_status?.reviewing_stage
        const gradingState = courseMaterialExercise.exercise_status?.grading_progress

        const sortedTasks = courseMaterialExercise.current_exercise_slide.exercise_tasks.toSorted(
          (a, b) => a.order_number - b.order_number,
        )

        const getTaskBlockerMessages = (task: CourseMaterialExerciseTask): string[] => {
          const answer = answers.get(task.id)
          if (answer?.valid) {
            return []
          }
          const answerRequest = t("answer-the-exercise-before-submitting")
          const showsIframe = showsExerciseTaskIframe({
            exerciseTask: task,
            canPostSubmission: courseMaterialExercise.can_post_submission,
            isChapterLocked: Boolean(isChapterLocked),
            signedIn: loginState.signedIn,
          })
          if (!showsIframe) {
            return [answerRequest]
          }
          const connectionStatus = connectionStatuses.get(task.id)
          if (connectionStatus === "failed") {
            return [t("submission-blocked-task-not-loaded")]
          }
          if (answer) {
            return answer.validityMessages?.length ? answer.validityMessages : [answerRequest]
          }
          if (connectionStatus === "connected") {
            return [answerRequest]
          }
          return [t("submission-blocked-task-loading")]
        }

        // Already-localized reasons the submit button is disabled, shown next to it so students
        // understand why (course-improvements-issues#161). Answer-specific reasons come from the
        // exercise iframe (e.g. a Timeline duplicate); host-side ones (deadline, language version,
        // cannot post) are added here.
        const submissionBlockers: SubmissionBlocker[] = sortedTasks.flatMap((task) =>
          getTaskBlockerMessages(task).map((message) => ({
            message,
            show: () => taskHandlesRef.current.get(task.id)?.focusFirstInvalid(),
          })),
        )
        if (exerciseDeadline && exerciseDeadline.getTime() < Date.now()) {
          submissionBlockers.push({
            message: t("submission-blocked-deadline-passed", { deadline: deadlineAsString }),
          })
        }
        if (userOnWrongLanguageVersion) {
          submissionBlockers.push({ message: t("submission-blocked-wrong-language") })
        }
        if (!courseMaterialExercise.can_post_submission) {
          submissionBlockers.push({ message: t("submission-blocked-cannot-submit") })
        }
        const uniqueSubmissionBlockers = uniqBy(submissionBlockers, (blocker) => blocker.message)

        return (
          <ExerciseCardWrapper
            ref={sectionRef}
            id={getExerciseBlockBeginningScrollingId(id)}
            ariaLabelledby={exerciseTitleId}
          >
            <ExerciseCardHeader
              title={
                <ExerciseCardTitle
                  id={exerciseTitleId}
                  ref={exerciseTitleRef}
                  tabIndex={-1}
                  name={courseMaterialExercise.exercise.name}
                />
              }
              rightContent={
                <div
                  className={css`
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 16px;
                    flex-wrap: wrap;
                    width: 100%;
                    ${respondToOrLarger.xxs} {
                      width: auto;
                      justify-content: flex-end;
                    }
                  `}
                >
                  {limit_number_of_tries &&
                    maxTries !== null &&
                    maxTries !== undefined &&
                    triesRemaining !== null && (
                      <ExerciseCardTriesBadge triesRemaining={triesRemaining} />
                    )}
                  {isExam && points === null ? (
                    <div
                      className={cx(
                        exerciseCardPillShell,
                        css`
                          height: auto;
                          min-height: 0;
                          padding: 4px 10px 5px;
                          box-sizing: border-box;
                          justify-content: center;
                          gap: 0;

                          & > div {
                            display: flex;
                            flex-direction: column;
                            align-items: center;
                            justify-content: center;
                            gap: 2px;
                            min-width: 0;
                            max-width: 100%;
                          }

                          .heading {
                            color: #57606f;
                            font-size: 10px;
                            margin-bottom: 0;
                            line-height: 1.15;
                            text-align: center;
                            overflow-wrap: anywhere;
                            display: -webkit-box;
                            -webkit-box-orient: vertical;
                            -webkit-line-clamp: 2;
                            overflow: hidden;

                            ${respondToOrLarger.xs} {
                              font-size: 12px;
                            }

                            ${respondToOrLarger.lg} {
                              font-size: 13px;
                            }
                          }

                          .value {
                            font-size: 1rem;
                            line-height: 1.2;
                            margin-top: 0;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            max-width: 100%;
                            overflow: hidden;
                            text-overflow: ellipsis;
                            white-space: nowrap;
                          }
                        `,
                      )}
                    >
                      <div>
                        <span className="heading">{t("max-points")}</span>
                        <div className="value">{courseMaterialExercise.exercise.score_maximum}</div>
                      </div>
                    </div>
                  ) : (
                    <ExerciseCardPointsBadge
                      score={points ?? 0}
                      maxScore={courseMaterialExercise.exercise.score_maximum ?? 0}
                    />
                  )}
                </div>
              }
            />

            {chapterLockingEnabled &&
              courseMaterialExercise &&
              !isChapterLocked &&
              courseMaterialExercise.exercise.teacher_reviews_answer_after_locking && (
                <div
                  className={css`
                    padding: 0 1.5rem;
                    margin-bottom: 1rem;
                  `}
                >
                  <YellowBox>{t("exercises-done-through-locking-explanation")}</YellowBox>
                </div>
              )}

            {!loginState.isLoading && !loginState.signedIn && (
              <div
                className={css`
                  padding: 0 1rem;
                  margin-bottom: 2rem;
                `}
              >
                <YellowBox>{t("please-log-in-to-answer-exercise")}</YellowBox>

                <AWithNoDecoration href={loginRoute(returnTo)}>
                  <button className={cx(exerciseButtonStyles, makeExerciseButtonMutedStyles)}>
                    {t("log-in")}
                  </button>
                </AWithNoDecoration>
                <AWithNoDecoration href={signUpRoute(returnTo)}>
                  <button className={cx(exerciseButtonStyles)}>{t("create-new-account")}</button>
                </AWithNoDecoration>
              </div>
            )}

            <div
              className={css`
                padding: 0 1rem;
                ${
                  !loginState.isLoading &&
                  !loginState.signedIn &&
                  `
              pointer-events: none !important;
              user-select: none !important;
              filter: blur(2px);
              opacity: 0.9;
              `
                }
              `}
              {...{ inert: !loginState.isLoading && !loginState.signedIn }}
            >
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
              <ExerciseStatusMessage
                gradingProgress={gradingState}
                reviewingStage={reviewingStage}
                peerOrSelfReviewConfig={courseMaterialExercise.peer_or_self_review_config}
                exercise={courseMaterialExercise.exercise}
                shouldSeeResetMessage={courseMaterialExercise.should_show_reset_message ?? null}
                teacherGradingDecision={courseMaterialExercise.teacher_grading_decision ?? null}
              />
              {/* Reviewing stage seems to be undefined at least for exams */}
              {reviewingStage !== "PeerReview" &&
                reviewingStage !== "SelfReview" &&
                sortedTasks.map((task) => (
                  <ExerciseTask
                    key={task.id}
                    ref={(handle) => {
                      if (handle) {
                        taskHandlesRef.current.set(task.id, handle)
                      } else {
                        taskHandlesRef.current.delete(task.id)
                      }
                    }}
                    onConnectionStateChange={({ status }) =>
                      setConnectionStatuses((prev) =>
                        prev.get(task.id) === status ? prev : new Map(prev).set(task.id, status),
                      )
                    }
                    exerciseTask={task}
                    isExam={isExam}
                    setAnswer={(answer) =>
                      setAnswers((prev) => new Map([...prev, [task.id, answer]]))
                    }
                    postThisStateToIFrame={postThisStateToIFrame?.find(
                      (x) => x.exercise_task_id === task.id,
                    )}
                    canPostSubmission={courseMaterialExercise.can_post_submission}
                    exerciseNumber={courseMaterialExercise.exercise.order_number ?? 0}
                    exerciseName={courseMaterialExercise.exercise.name}
                    isChapterLocked={Boolean(isChapterLocked)}
                  />
                ))}
              {reviewingStage === "PeerReview" && (
                <PeerOrSelfReviewView
                  exerciseNumber={courseMaterialExercise.exercise.order_number ?? 0}
                  exerciseId={id}
                  parentExerciseQuery={getCourseMaterialExercise}
                />
              )}
              {reviewingStage === "SelfReview" && (
                <PeerOrSelfReviewView
                  exerciseNumber={courseMaterialExercise.exercise.order_number ?? 0}
                  exerciseId={id}
                  parentExerciseQuery={getCourseMaterialExercise}
                  selfReview
                />
              )}
              {(reviewingStage === "WaitingForPeerReviews" ||
                reviewingStage === "ReviewedAndLocked" ||
                reviewingStage === "Locked") && (
                <div
                  className={css`
                    padding: 0.5rem 0.45rem;
                    background-color: white;
                    border-radius: 0.625rem;
                  `}
                >
                  {reviewingStage === "WaitingForPeerReviews" && (
                    <WaitingForPeerReviews exerciseId={id} />
                  )}
                  {inSubmissionView &&
                    courseMaterialExercise.exercise.needs_peer_review &&
                    exerciseSlideSubmissionId &&
                    (reviewingStage === "WaitingForPeerReviews" ||
                      reviewingStage === "ReviewedAndLocked" ||
                      reviewingStage === "Locked") && (
                      <PeerOrSelfReviewsReceived id={id} submissionId={exerciseSlideSubmissionId} />
                    )}
                </div>
              )}
              {isChapterLocked &&
                reviewingStage !== "ReviewedAndLocked" &&
                reviewingStage !== "Locked" &&
                reviewingStage !== "NotAnsweredAndLocked" &&
                (isChapterNotAccessible ||
                  courseMaterialExercise.exercise.teacher_reviews_answer_after_locking !==
                    false) && (
                  <YellowBox>
                    <div
                      className={css`
                        display: flex;
                        align-items: center;
                        gap: 0.75rem;
                      `}
                    >
                      <Padlock size={24} />
                      <div>
                        {isChapterNotAccessible
                          ? t("chapter-locked-complete-previous")
                          : t("chapter-locked-description")}
                      </div>
                    </div>
                  </YellowBox>
                )}
              <OutOfTriesNotification
                ranOutOfTries={Boolean(ranOutOfTries)}
                reviewingStage={reviewingStage}
              />
              <div>
                {!inSubmissionView && !isChapterLocked && (
                  <ExerciseSubmitButton
                    isPending={postSubmissionMutation.isPending}
                    blockers={uniqueSubmissionBlockers}
                    buttonClassName={cx(exerciseButtonStyles)}
                    onSubmit={() => {
                      if (!courseInstanceId && !courseMaterialExercise.exercise.exam_id) {
                        return
                      }
                      postSubmissionMutation.mutate(
                        {
                          exercise_slide_id: courseMaterialExercise.current_exercise_slide.id,
                          exercise_task_submissions:
                            courseMaterialExercise.current_exercise_slide.exercise_tasks.map(
                              (task) =>
                                capturedAnswerToTaskSubmission(task.id, answers.get(task.id)),
                            ),
                        },
                        {
                          onSuccess: (res) => {
                            // Additional check to make sure we're not accidentally leaking gradings in exams from this endpoint
                            if (
                              isExam &&
                              res.exercise_task_submission_results.some(
                                (result) => result.grading !== null,
                              )
                            ) {
                              throw new Error("Exams should have hidden gradings")
                            }
                          },
                        },
                      )
                    }}
                  />
                )}

                {userOnWrongLanguageVersion &&
                  courseMaterialState.settings &&
                  courseMaterialState.organization && (
                    <UserOnWrongCourseNotification
                      correctCourseId={courseMaterialState.settings.current_course_id}
                      organizationSlug={courseMaterialState.organization?.slug}
                      variant="compact"
                    />
                  )}

                {inSubmissionView &&
                  (reviewingStage === "NotStarted" || reviewingStage === undefined) && (
                    <div>
                      {isExam && !courseMaterialState.examData?.ended && (
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
                      <div
                        className={css`
                          display: flex;
                          justify-content: center;
                          column-gap: 0.625rem;
                          button {
                            margin: 0 !important;
                          }
                        `}
                      >
                        {!ranOutOfTries && !(isExam && courseMaterialState.examData?.ended) && (
                          <button
                            className={cx(exerciseButtonStyles)}
                            onClick={() => {
                              tryAgainMutation.mutate()
                            }}
                            disabled={
                              // Polling for a pending grading refetches every few seconds.
                              (getCourseMaterialExercise.isRefetching &&
                                !isGradingPending(getCourseMaterialExercise.data)) ||
                              !courseMaterialExercise.can_post_submission ||
                              tryAgainMutation.isPending
                            }
                          >
                            {t("try-again")}
                          </button>
                        )}
                        {needsPeerReview && (
                          <button
                            className={cx(exerciseButtonStyles)}
                            disabled={startPeerOrSelfReviewMutation.isPending}
                            onClick={() => startPeerOrSelfReviewMutation.mutate()}
                          >
                            {t("start-peer-review")}
                          </button>
                        )}
                        {!needsPeerReview && needsSelfReview && (
                          <button
                            className={cx(exerciseButtonStyles)}
                            disabled={startPeerOrSelfReviewMutation.isPending}
                            onClick={() => startPeerOrSelfReviewMutation.mutate()}
                          >
                            {t("start-self-review")}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                {postSubmissionMutation.isError && (
                  <ErrorNotice error={postSubmissionMutation.error} />
                )}
              </div>
            </div>
          </ExerciseCardWrapper>
        )
      }}
    </QueryResult>
  )
}

/**
 * The previous view might have been a lot taller than the next view, which would cause the browser to jump down as the view changes and the execise block gets a lot shorter. This function makes sure that the exercise block will stay visible upto half a second after the view has changed.
 */
function makeSureComponentStaysVisibleAfterChangingView(ref: React.RefObject<HTMLElement | null>) {
  if (!ref || !ref.current) {
    return
  }
  function scrollToViewIfNeeded() {
    if (!ref.current) {
      return
    }
    const boundingBox = ref.current.getBoundingClientRect()
    if (boundingBox.bottom < 0) {
      ref.current.scrollIntoView()
    }
  }
  setTimeout(scrollToViewIfNeeded, 100)
  setTimeout(scrollToViewIfNeeded, 200)
  setTimeout(scrollToViewIfNeeded, 300)
  setTimeout(scrollToViewIfNeeded, 400)
  setTimeout(scrollToViewIfNeeded, 500)
}

export default withErrorBoundary(withSuspenseBoundary(ExerciseBlock))
