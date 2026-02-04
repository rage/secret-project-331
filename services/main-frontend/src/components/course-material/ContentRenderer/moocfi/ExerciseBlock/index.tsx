"use client"

import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import { useQueryClient } from "@tanstack/react-query"
import { CheckCircle, Padlock, PlusHeart } from "@vectopus/atlas-icons-react"
import { produce } from "immer"
import { useAtomValue } from "jotai"
import { usePathname, useSearchParams } from "next/navigation"
import { useContext, useEffect, useId, useMemo, useReducer, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { BlockRendererProps } from "../.."

import ExerciseStatusMessage from "./ExerciseStatusMessage"
import ExerciseTask from "./ExerciseTask"
import PeerOrSelfReviewView from "./PeerOrSelfReviewView"
import PeerOrSelfReviewsReceived from "./PeerOrSelfReviewView/PeerOrSelfReviewsReceivedComponent/index"
import WaitingForPeerReviews from "./PeerOrSelfReviewView/WaitingForPeerReviews"

import YellowBox from "@/components/course-material/YellowBox"
import UserOnWrongCourseNotification from "@/components/course-material/notifications/UserOnWrongCourseNotification"
import useCourseMaterialExerciseQuery, {
  courseMaterialExerciseQueryKey,
} from "@/hooks/course-material/useCourseMaterialExerciseQuery"
import { useUserChapterLocks } from "@/hooks/course-material/useUserChapterLocks"
import exerciseBlockPostThisStateToIFrameReducer from "@/reducers/course-material/exerciseBlockPostThisStateToIFrameReducer"
import { postStartPeerOrSelfReview, postSubmission } from "@/services/course-material/backend"
import {
  CourseMaterialExercise,
  StudentExerciseSlideSubmission,
} from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import HideTextInSystemTests from "@/shared-module/common/components/system-tests/HideTextInSystemTests"
import LoginStateContext from "@/shared-module/common/contexts/LoginStateContext"
import { useDateStringAsDateNullable } from "@/shared-module/common/hooks/useDateStringAsDate"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import { baseTheme, headingFont, secondaryFont } from "@/shared-module/common/styles"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { dateDiffInDays } from "@/shared-module/common/utils/dateUtil"
import { useCurrentPagePathForReturnTo } from "@/shared-module/common/utils/redirectBackAfterLoginOrSignup"
import { loginRoute, signUpRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import withSuspenseBoundary from "@/shared-module/common/utils/withSuspenseBoundary"
import { courseMaterialAtom } from "@/state/course-material"

const FORWARD_SLASH = "/"

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

  &:disabled {
    background: #929896;
    box-shadow:
      rgba(45, 35, 66, 0) 0 4px 8px,
      rgba(45, 35, 66, 0) 0 7px 13px -3px,
      #68716c 0 -3px 0 inset;
    cursor: not-allowed;
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

// Special care taken here to ensure exercise content can have full width of
// the page.
const ExerciseBlock: React.FC<
  React.PropsWithChildren<BlockRendererProps<ExerciseBlockAttributes>>
> = (props) => {
  const sectionRef = useRef<HTMLElement>(null)
  const exerciseTitleId = useId()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const returnTo = useCurrentPagePathForReturnTo(
    pathname + (searchParams.toString() ? `?${searchParams.toString()}` : ""),
  )
  const [answers, setAnswers] = useState<Map<string, { valid: boolean; data: unknown }>>(new Map())
  const [points, setPoints] = useState<number | null>(null)
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation()
  const loginState = useContext(LoginStateContext)
  const courseMaterialState = useAtomValue(courseMaterialAtom)
  const showExercise =
    Boolean(courseMaterialState.examData?.id) ||
    (loginState.signedIn ? !!courseMaterialState.settings : true)
  const [postThisStateToIFrame, dispatch] = useReducer(
    exerciseBlockPostThisStateToIFrameReducer,
    null,
  )
  const userOnWrongLanguageVersion =
    courseMaterialState.settings &&
    courseMaterialState.settings.current_course_instance_id !== courseMaterialState.instance?.id

  const id = props.data.attributes.id
  const getCourseMaterialExercise = useCourseMaterialExerciseQuery(id, showExercise)
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
    if (getCourseMaterialExercise.data.exercise_status?.score_given) {
      setPoints(getCourseMaterialExercise.data.exercise_status?.score_given)
    }
    const chapterId = getCourseMaterialExercise.data.exercise.chapter_id
    const chapterStatus = chapterId
      ? getUserLocks.data?.find((status) => status.chapter_id === chapterId)
      : null
    const isChapterLocked =
      chapterId &&
      (chapterStatus?.status === "completed_and_locked" ||
        chapterStatus?.status === "not_unlocked_yet")
    dispatch({
      type: "exerciseDownloaded",
      payload: getCourseMaterialExercise.data,
      signedIn: Boolean(loginState.signedIn),
      isChapterLocked: Boolean(isChapterLocked),
    })
    const a = new Map()
    getCourseMaterialExercise.data.current_exercise_slide.exercise_tasks.map((et) => {
      if (et.previous_submission) {
        a.set(et.id, { valid: true, data: et.previous_submission.data_json ?? null })
      }
    })
    setAnswers(a)
  }, [getCourseMaterialExercise.data, loginState.signedIn, getUserLocks.data])

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
      const chapterId = data.exercise.chapter_id
      const chapterStatus = chapterId
        ? getUserLocks.data?.find((status) => status.chapter_id === chapterId)
        : null
      const isChapterLocked =
        chapterId &&
        chapterLockingEnabled &&
        (chapterStatus?.status === "completed_and_locked" ||
          chapterStatus?.status === "not_unlocked_yet")
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
        await getCourseMaterialExercise.refetch()
        const a = new Map()
        getCourseMaterialExercise.data.current_exercise_slide.exercise_tasks.map((et) => {
          if (et.previous_submission) {
            a.set(et.id, { valid: true, data: et.previous_submission.data_json ?? null })
          }
        })
        setAnswers(a)
      }
      makeSureComponentStaysVisibleAfterChangingView(sectionRef)
    },
    {
      notify: false,
    },
  )
  const exerciseDeadline = useDateStringAsDateNullable(
    getCourseMaterialExercise.data?.exercise.deadline,
  )

  const startPeerOrSelfReviewMutation = useToastMutation(
    () => postStartPeerOrSelfReview(id),
    { notify: false },
    {
      onSuccess: async () => {
        await getCourseMaterialExercise.refetch()
      },
    },
  )

  const exerciseNameIsLong = useMemo(() => {
    if (!getCourseMaterialExercise.data) {
      return false
    }
    return getCourseMaterialExercise.data.exercise.name.length > 35
  }, [getCourseMaterialExercise.data])

  if (!showExercise) {
    return <div>{t("please-select-course-instance-before-answering-exercise")}</div>
  }

  if (getCourseMaterialExercise.isError) {
    return <ErrorBanner variant={"readOnly"} error={getCourseMaterialExercise.error} />
  }
  if (getCourseMaterialExercise.isLoading || !getCourseMaterialExercise.data) {
    return <Spinner variant={"medium"} />
  }

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
    getCourseMaterialExercise.data.exercise_slide_submission_counts[
      getCourseMaterialExercise.data.current_exercise_slide.id
    ] ?? 0

  const maxTries = getCourseMaterialExercise.data.exercise.max_tries_per_slide

  const triesRemaining = maxTries && maxTries - spentTries

  const limit_number_of_tries = getCourseMaterialExercise.data.exercise.limit_number_of_tries
  const ranOutOfTries =
    limit_number_of_tries && maxTries !== null && triesRemaining !== null && triesRemaining <= 0

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
  const needsSelfReview = getCourseMaterialExercise.data.exercise.needs_self_review

  const reviewingStage = getCourseMaterialExercise.data.exercise_status?.reviewing_stage
  const gradingState = getCourseMaterialExercise.data.exercise_status?.grading_progress
  return (
    <>
      {/* Exercises are so important part of the pages that we will use section to make it easy-to-find
      for screenreader users */}
      <section
        className={css`
          width: 100%;
          background: #f2f2f2;
          border-radius: 1rem;
          margin-bottom: 1rem;
          padding-bottom: 1.25rem;
          position: relative;
        `}
        id={getExerciseBlockBeginningScrollingId(id)}
        aria-labelledby={exerciseTitleId}
        ref={sectionRef}
      >
        <div>
          <div>
            <div
              className={css`
                display: flex;
                gap: 5px;
                align-items: center;
                margin-bottom: 1.5rem;
                padding: 1.5rem 1.2rem;
                background: #718dbf;
                border-radius: 1rem 1rem 0 0;
                color: white;
                flex-direction: column;

                ${respondToOrLarger.xxs} {
                  flex-direction: row;
                }
              `}
            >
              <h2
                id={exerciseTitleId}
                className={css`
                  font-size: ${exerciseNameIsLong ? "1.4rem" : "1.7rem"};
                  font-weight: 500;
                  font-family: ${headingFont} !important;
                  overflow-wrap: anywhere;
                  overflow: hidden;
                  margin-top: -2px;
                `}
              >
                <div
                  className={css`
                    font-weight: 600;
                    font-size: 18px;
                    margin-bottom: 0.25rem;
                    color: #1b222c;
                  `}
                >
                  {t("label-exercise")}:
                </div>
                <div
                  className={css`
                    line-height: 30px;
                    overflow: hidden;
                    max-height: 80px;
                    /* Prevents some characters, like 3, from clipping */
                    padding-bottom: 0.2rem;

                    ${respondToOrLarger.xs} {
                      max-height: 60px;
                    }
                  `}
                >
                  {getCourseMaterialExercise.data.exercise.name}
                </div>
              </h2>
              <div
                className={css`
                  flex-grow: 1;
                `}
              />
              <div
                className={css`
                  font-size: 9px;
                  text-align: center;
                  font-family: ${secondaryFont} !important;
                  text-transform: uppercase;
                  border-radius: 10px;
                  background: #f0f0f0;
                  height: 60px;
                  padding: 8px 16px 6px 16px;

                  color: #57606f;
                  display: flex;
                  justify-content: center;
                  flex-direction: columns;
                  gap: 16px;
                  box-shadow:
                    rgba(45, 35, 66, 0) 0 2px 4px,
                    rgba(45, 35, 66, 0) 0 7px 13px -3px,
                    #c4c4c4 0 -3px 0 inset;

                  .points {
                    line-height: 100%;
                    color: #57606f;
                    z-index: 999;
                  }

                  .heading {
                    color: #57606f;
                    font-size: 12px;
                    display: inline-block;
                    margin-bottom: 2px;
                  }

                  sup,
                  sub {
                    font-family: ${headingFont} !important;
                    color: #57606f;
                    font-size: 15px;
                    font-weight: 500;
                    margin: 0;
                  }

                  svg {
                    margin-right: 4px;
                  }

                  .tries {
                    font-family: ${headingFont} !important;
                    display: flex;
                    color: #57606f;
                    font-size: 14px;
                    font-weight: 500;
                    line-height: 0.8;
                  }

                  p {
                    font-size: 16px;
                  }

                  width: 100%;
                  ${respondToOrLarger.xxs} {
                    width: auto;
                  }
                `}
              >
                {limit_number_of_tries && maxTries !== null && triesRemaining !== null && (
                  <div
                    className={css`
                      display: block;
                    `}
                  >
                    <span className="heading">{t("tries")}</span>
                    <div className="tries">
                      <PlusHeart size={16} weight="bold" color="#394F77" />
                      <p>{triesRemaining}</p>
                    </div>
                  </div>
                )}
                {isExam && points === null ? (
                  <div
                    className={css`
                      display: flex;
                      flex-direction: column;
                    `}
                  >
                    <div>{t("max-points")}</div>{" "}
                    <div
                      className={css`
                        font-size: 1rem;
                        margin-top: 3px;
                      `}
                    >
                      {getCourseMaterialExercise.data.exercise.score_maximum}
                    </div>
                  </div>
                ) : (
                  <div>
                    <span className="heading">{t("points-label")}</span>
                    <div className="points">
                      <CheckCircle size={16} weight="bold" color="#394F77" />
                      <span data-testid="exercise-points">
                        {}
                        <sup>{points ?? 0}</sup>
                        {FORWARD_SLASH}
                        <sub>{getCourseMaterialExercise.data.exercise.score_maximum}</sub>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {chapterLockingEnabled && getCourseMaterialExercise.data && !isChapterLocked && (
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
            ${!loginState.isLoading &&
            !loginState.signedIn &&
            `
              pointer-events: none !important;
              user-select: none !important;
              filter: blur(2px);
              opacity: 0.9;
              `}
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
            peerOrSelfReviewConfig={getCourseMaterialExercise.data.peer_or_self_review_config}
            exercise={getCourseMaterialExercise.data.exercise}
            shouldSeeResetMessage={getCourseMaterialExercise.data.should_show_reset_message}
          />
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
                  isChapterLocked={Boolean(isChapterLocked)}
                />
              ))}
          {reviewingStage === "PeerReview" && (
            <PeerOrSelfReviewView
              exerciseNumber={getCourseMaterialExercise.data.exercise.order_number}
              exerciseId={id}
              parentExerciseQuery={getCourseMaterialExercise}
            />
          )}
          {reviewingStage === "SelfReview" && (
            <PeerOrSelfReviewView
              exerciseNumber={getCourseMaterialExercise.data.exercise.order_number}
              exerciseId={id}
              parentExerciseQuery={getCourseMaterialExercise}
              selfReview
            />
          )}
          {(reviewingStage === "WaitingForPeerReviews" ||
            reviewingStage === "ReviewedAndLocked") && (
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
                getCourseMaterialExercise.data.exercise.needs_peer_review &&
                exerciseSlideSubmissionId &&
                (reviewingStage === "WaitingForPeerReviews" ||
                  reviewingStage === "ReviewedAndLocked") && (
                  <PeerOrSelfReviewsReceived id={id} submissionId={exerciseSlideSubmissionId} />
                )}
            </div>
          )}
          {isChapterLocked && reviewingStage !== "ReviewedAndLocked" && (
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
          <div>
            {getCourseMaterialExercise.data.can_post_submission &&
              !userOnWrongLanguageVersion &&
              !inSubmissionView &&
              !isChapterLocked && (
                <button
                  disabled={
                    postSubmissionMutation.isPending ||
                    answers.size < (postThisStateToIFrame?.length ?? 0) ||
                    Array.from(answers.values()).some((x) => !x.valid)
                  }
                  className={cx(exerciseButtonStyles)}
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
                            courseMaterialExerciseQueryKey(id),
                            (old: CourseMaterialExercise | undefined) => {
                              if (!old) {
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
                </button>
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
                          getCourseMaterialExercise.isRefetching ||
                          !getCourseMaterialExercise.data.can_post_submission ||
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
              <ErrorBanner variant={"readOnly"} error={postSubmissionMutation.error} />
            )}
          </div>
        </div>
      </section>
    </>
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
