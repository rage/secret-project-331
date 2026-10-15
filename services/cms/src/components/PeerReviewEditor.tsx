"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { XmarkCircle } from "@vectopus/atlas-icons-react"
import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { v4 } from "uuid"

import type {
  CmsPeerOrSelfReviewConfig,
  CmsPeerOrSelfReviewQuestion,
  PeerOrSelfReviewQuestionType,
  PeerReviewProcessingStrategy,
} from "@/generated/api"
import {
  getCmsCourseDefaultPeerReviewOptions,
  getCmsCourseOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { baseTheme } from "@/shared-module/common/styles"
import { editCourseDefaultPeerOrSelfReviewConfigRoute } from "@/shared-module/common/utils/routes"
import { Button, Checkbox, Link, Select, TextArea, TextField } from "@/shared-module/components"
import { QueryResult } from "@/shared-module/components/components/queryResult/QueryResult"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"
import { useAttributeForm } from "@/utils/useAttributeForm"
import { useTranslation } from "@/utils/useCmsTranslation"

import type { ExerciseAttributes } from "../blocks/Exercise"

const Wrapper = styled.div`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
  margin: 0 auto;
  max-width: 1000px;
  height: 100%;
  h2 {
    margin: var(--space-2) 0 0;
    font-weight: 600;
    font-size: 1.25rem;
    line-height: 1.2;
  }
`

const reviewSettingsCss = css`
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
`

const List = styled.div`
  display: grid;
  grid-template-columns: minmax(14rem, 0.7fr) minmax(0, 1.5fr) 10rem 3rem;
  align-items: start;
  gap: var(--space-3);
  @media (max-width: 767.98px) {
    grid-template-columns: minmax(0, 1fr);
  }
`
const QuestionCell = styled.div`
  background: var(--color-gray-50);
  border: 1.5px solid var(--color-gray-300);
  border-radius: var(--radius-2);
  width: 100%;
  padding: var(--space-3) var(--space-4);
`

export interface PeerReviewEditorExtraProps {
  attributes: Readonly<Partial<ExerciseAttributes>>
  setAttributes: (attr: Partial<ExerciseAttributes>) => void
  exerciseId?: string
  courseId: string
  courseGlobalEditor: boolean
  instructionsEditor: React.ReactNode
}

export type PeerReviewEditorProps = React.HTMLAttributes<HTMLDivElement> &
  PeerReviewEditorExtraProps

interface ReviewToggleValues {
  needsPeerReview: boolean
  needsSelfReview: boolean
  useCourseDefaultConfig: boolean
}

interface ReviewConfigValues {
  peerReviewsToReceive: string
  peerReviewsToGive: string
  processingStrategy: PeerReviewProcessingStrategy
  pointsAreAllOrNothing: boolean
  resetAnswerIfZeroPoints: boolean
  acceptingThreshold: string
}

type QuestionChange =
  | { field: "question" | "question_type" | "weight"; value: string }
  | { field: "answer_required"; value: boolean }

interface QuestionValues {
  questionType: PeerOrSelfReviewQuestionType
  weight: string
  question: string
  answerRequired: boolean
}

/* oxlint-disable i18next/no-literal-string */
const CONFIG_FIELD_BY_FORM_FIELD: Record<
  keyof ReviewConfigValues,
  keyof CmsPeerOrSelfReviewConfig
> = {
  peerReviewsToReceive: "peer_reviews_to_receive",
  peerReviewsToGive: "peer_reviews_to_give",
  processingStrategy: "processing_strategy",
  pointsAreAllOrNothing: "points_are_all_or_nothing",
  resetAnswerIfZeroPoints: "reset_answer_if_zero_points_from_review",
  acceptingThreshold: "accepting_threshold",
}

const QUESTION_FIELD_BY_FORM_FIELD: Record<keyof QuestionValues, QuestionChange["field"]> = {
  questionType: "question_type",
  weight: "weight",
  question: "question",
  answerRequired: "answer_required",
}
/* oxlint-enable i18next/no-literal-string */

interface QuestionRowProps {
  question: CmsPeerOrSelfReviewQuestion
  typeOptions: { label: string; value: PeerOrSelfReviewQuestionType }[]
  showWeight: boolean
  onChange: (change: QuestionChange) => void
  onDelete: () => void
}

const QuestionRow: React.FC<QuestionRowProps> = ({
  question,
  typeOptions,
  showWeight,
  onChange,
  onDelete,
}) => {
  const { t } = useTranslation()
  const { control } = useAttributeForm<QuestionValues>(
    {
      questionType: question.question_type,
      weight: String(question.weight),
      question: question.question,
      answerRequired: question.answer_required,
    },
    (values, changedName) =>
      onChange({
        field: QUESTION_FIELD_BY_FORM_FIELD[changedName],
        value: values[changedName],
      } as QuestionChange),
  )

  return (
    <List id={question.id}>
      <QuestionCell>
        <Select
          name="questionType"
          control={control}
          label={t("peer-review-question-type")}
          options={typeOptions}
          id={`peer-review-question-${question.id}`}
        />
        {question.question_type === "Scale" && showWeight && (
          <TextField
            name="weight"
            control={control}
            label={t("label-weight")}
            type="number"
            min={0}
            max={1}
            step="0.01"
          />
        )}
      </QuestionCell>
      <QuestionCell>
        <TextArea name="question" control={control} label={t("peer-review-question")} autoResize />
      </QuestionCell>
      {question.question_type !== "Scale" ? (
        <QuestionCell>
          <Checkbox name="answerRequired" control={control} label={t("answer-required")} />
        </QuestionCell>
      ) : (
        <div aria-hidden />
      )}
      <Button
        variant="secondary"
        size="medium"
        aria-label={t("delete")}
        icon={<XmarkCircle />}
        onClick={onDelete}
      />
    </List>
  )
}

const PeerReviewEditor: React.FC<PeerReviewEditorProps> = ({
  id,
  exerciseId,
  courseId,
  attributes: exerciseAttributes,
  setAttributes: setExerciseAttributes,
  courseGlobalEditor,
  instructionsEditor,
}) => {
  const { t } = useTranslation()
  const peerReviewEnabled = exerciseAttributes.needs_peer_review ?? false
  const selfReviewEnabled = exerciseAttributes.needs_self_review ?? false

  const courseQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      isReady: (courseIdValue): courseIdValue is string => Boolean(courseIdValue),
      build: (courseIdValue) =>
        getCmsCourseOptions({
          path: {
            course_id: courseIdValue,
          },
        }),
    }),
  )

  const chapterLockingEnabled = courseQuery.data?.chapter_locking_enabled ?? false
  const isInitialMount = useRef(true)

  useEffect(() => {
    if (
      exerciseAttributes.use_course_default_peer_review === undefined ||
      exerciseAttributes.use_course_default_peer_review === null
    ) {
      setExerciseAttributes({ use_course_default_peer_review: true })
    }
  }, [exerciseAttributes.use_course_default_peer_review, setExerciseAttributes])

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false
      if (
        chapterLockingEnabled &&
        (exerciseAttributes.needs_peer_review || exerciseAttributes.needs_self_review)
      ) {
        setExerciseAttributes({
          needs_peer_review: false,
          needs_self_review: false,
        })
      }
    }
  }, [
    chapterLockingEnabled,
    exerciseAttributes.needs_peer_review,
    exerciseAttributes.needs_self_review,
    setExerciseAttributes,
  ])

  const defaultCmsPeerOrSelfReviewConfig = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      isReady: (courseIdValue): courseIdValue is string => Boolean(courseIdValue),
      build: (courseIdValue) =>
        getCmsCourseDefaultPeerReviewOptions({
          path: {
            course_id: courseIdValue,
          },
        }),
    }),
  )

  // Parse the stored config, falling back to a generated default for rendering. The default is
  // memoized so its random id stays stable across renders instead of being regenerated every render.
  const parsedPeerOrSelfReviewConfig: CmsPeerOrSelfReviewConfig = useMemo(() => {
    const parsed: CmsPeerOrSelfReviewConfig | null = JSON.parse(
      exerciseAttributes.peer_or_self_review_config ?? "null",
    )
    return parsed ?? defaultPeerOrSelfReviewConfig(exerciseId, courseId)
  }, [exerciseAttributes.peer_or_self_review_config, exerciseId, courseId])

  // Persist the generated default so it gets a stable id, but only when the exercise uses its own
  // config. While "use course default" is enabled the config is intentionally null; writing to it
  // here used to happen during render, which fought toggleUseDefaultPeerOrSelfReviewConfig and spun
  // the component into an infinite update loop (React error #185).
  useEffect(() => {
    if (
      !exerciseAttributes.use_course_default_peer_review &&
      (exerciseAttributes.peer_or_self_review_config === null ||
        exerciseAttributes.peer_or_self_review_config === undefined ||
        exerciseAttributes.peer_or_self_review_config === "null")
    ) {
      setExerciseAttributes({
        peer_or_self_review_config: JSON.stringify(parsedPeerOrSelfReviewConfig),
      })
    }
  }, [
    exerciseAttributes.use_course_default_peer_review,
    exerciseAttributes.peer_or_self_review_config,
    parsedPeerOrSelfReviewConfig,
    setExerciseAttributes,
  ])

  const parsedPeerOrSelfReviewQuestionConfig: CmsPeerOrSelfReviewQuestion[] = useMemo(() => {
    const res = JSON.parse(exerciseAttributes.peer_or_self_review_questions_config ?? "[]")
    if (res === null || res === undefined) {
      return []
    }
    return res
  }, [exerciseAttributes.peer_or_self_review_questions_config])

  // setExerciseAttributes propagates back through Gutenberg's store only on a later render, so
  // handlers reading the memoized snapshot see stale data. Two quick edits (e.g. a question's type
  // then its text) would both read it and the second would clobber the first. These refs hold the
  // latest values so handlers always read fresh.
  const peerOrSelfReviewConfigRef = useRef(parsedPeerOrSelfReviewConfig)
  const peerOrSelfReviewQuestionsRef = useRef(parsedPeerOrSelfReviewQuestionConfig)
  // Layout effects flush synchronously after render and before the next event, so an external change
  // (e.g. a Gutenberg undo) is mirrored into the refs before any handler can read them; a passive
  // effect could leave the refs stale for a follow-up edit that then reverts the external change.
  useLayoutEffect(() => {
    peerOrSelfReviewConfigRef.current = parsedPeerOrSelfReviewConfig
  }, [parsedPeerOrSelfReviewConfig])
  useLayoutEffect(() => {
    peerOrSelfReviewQuestionsRef.current = parsedPeerOrSelfReviewQuestionConfig
  }, [parsedPeerOrSelfReviewQuestionConfig])

  // Updates the refs before dispatching so a follow-up edit reads fresh values. setExerciseAttributes
  // merges, so only the changed fields are written.
  const commitPeerReview = (
    config: CmsPeerOrSelfReviewConfig,
    questions: CmsPeerOrSelfReviewQuestion[],
  ) => {
    peerOrSelfReviewConfigRef.current = config
    peerOrSelfReviewQuestionsRef.current = questions
    setExerciseAttributes({
      peer_or_self_review_config: JSON.stringify(config),
      peer_or_self_review_questions_config: JSON.stringify(questions),
    })
  }

  const peerOrSelfReviewQuestionTypeoptions: {
    label: string
    value: PeerOrSelfReviewQuestionType
  }[] = [
    // oxlint-disable-next-line i18next/no-literal-string
    { label: t("essay"), value: "Essay" },
    // oxlint-disable-next-line i18next/no-literal-string
    { label: t("likert-scale"), value: "Scale" },
  ]

  const peerReviewProcessingStrategyOptions: {
    label: string
    value: PeerReviewProcessingStrategy
  }[] = [
    {
      // oxlint-disable-next-line i18next/no-literal-string
      label: "Automatically grade by average",
      // oxlint-disable-next-line i18next/no-literal-string
      value: "AutomaticallyGradeByAverage",
    },
    {
      // oxlint-disable-next-line i18next/no-literal-string
      label: "Automatically grade or manual review by average",
      // oxlint-disable-next-line i18next/no-literal-string
      value: "AutomaticallyGradeOrManualReviewByAverage",
    },
    {
      // oxlint-disable-next-line i18next/no-literal-string
      label: "Manual review everything",
      // oxlint-disable-next-line i18next/no-literal-string
      value: "ManualReviewEverything",
    },
  ]

  const handlePeerReviewValueChange = (value: string, field: keyof CmsPeerOrSelfReviewConfig) => {
    const current = peerOrSelfReviewConfigRef.current
    let peerOrSelfReviewConfig = current
    // Ignore empty/non-numeric input so clearing a field to retype does not silently persist 0
    // (Number("") === 0) or null (NaN serializes to null).
    const isNumericField =
      field === "accepting_threshold" ||
      field === "peer_reviews_to_give" ||
      field === "peer_reviews_to_receive"
    if (isNumericField && (value === "" || Number.isNaN(Number(value)))) {
      return
    }
    switch (field) {
      case "processing_strategy":
        peerOrSelfReviewConfig = {
          ...current,
          processing_strategy: value as PeerReviewProcessingStrategy,
        }
        break
      case "accepting_threshold":
        peerOrSelfReviewConfig = {
          ...current,
          accepting_threshold: Number(value),
        }
        break
      case "peer_reviews_to_give":
        peerOrSelfReviewConfig = {
          ...current,
          peer_reviews_to_give: Number(value),
        }
        break
      case "peer_reviews_to_receive":
        peerOrSelfReviewConfig = {
          ...current,
          peer_reviews_to_receive: Number(value),
        }
        break
      case "points_are_all_or_nothing":
        peerOrSelfReviewConfig = {
          ...current,
          points_are_all_or_nothing: value === "true",
        }
        break
      case "reset_answer_if_zero_points_from_review":
        peerOrSelfReviewConfig = {
          ...current,
          reset_answer_if_zero_points_from_review: value === "true",
        }
        break
      default:
        break
    }
    commitPeerReview(peerOrSelfReviewConfig, peerOrSelfReviewQuestionsRef.current)
  }

  const handlePeerOrSelfReviewQuestionValueChange = (
    questionId: string,
    change: QuestionChange,
  ) => {
    const peerOrSelfReviewQuestions: CmsPeerOrSelfReviewQuestion[] =
      peerOrSelfReviewQuestionsRef.current
        .map((prq) => {
          if (prq.id !== questionId) {
            return prq
          }
          switch (change.field) {
            case "question":
              return { ...prq, question: change.value }
            case "question_type":
              return { ...prq, question_type: change.value as PeerOrSelfReviewQuestionType }
            case "answer_required":
              return { ...prq, answer_required: change.value }
            case "weight": {
              let newWeight = Number(change.value)
              if (Number.isNaN(newWeight) || newWeight < 0 || newWeight > 1) {
                newWeight = 0
              }
              return { ...prq, weight: newWeight }
            }
            default:
              return prq
          }
        })
        .toSorted((o1, o2) => o1.order_number - o2.order_number)

    commitPeerReview(peerOrSelfReviewConfigRef.current, peerOrSelfReviewQuestions)
  }

  const toggleUseDefaultPeerOrSelfReviewConfig = (checked: boolean) => {
    const prc = defaultPeerOrSelfReviewConfig(exerciseId, courseId)

    peerOrSelfReviewConfigRef.current = prc
    peerOrSelfReviewQuestionsRef.current = []
    setExerciseAttributes({
      use_course_default_peer_review: checked,
      // oxlint-disable-next-line i18next/no-literal-string
      peer_or_self_review_config: checked ? "null" : JSON.stringify(prc),
      // oxlint-disable-next-line i18next/no-literal-string
      peer_or_self_review_questions_config: checked ? "null" : "[]",
    })
  }

  const addPeerOrSelfReviewQuestion = (peerReviewId: string) => {
    const questions = peerOrSelfReviewQuestionsRef.current
    commitPeerReview(peerOrSelfReviewConfigRef.current, [
      ...questions,
      {
        id: v4(),
        question: t("default-question"),
        // oxlint-disable-next-line i18next/no-literal-string
        question_type: "Essay",
        peer_or_self_review_config_id: peerReviewId,
        answer_required: true,
        order_number: questions.length,
        weight: 0,
      } satisfies CmsPeerOrSelfReviewQuestion,
    ])
  }

  const deletePeerOrSelfReviewQuestion = (peerOrSelfReviewQuestionId: string) => {
    commitPeerReview(
      peerOrSelfReviewConfigRef.current,
      peerOrSelfReviewQuestionsRef.current
        .filter((x) => x.id !== peerOrSelfReviewQuestionId)
        .map((prq, idx) => {
          return { ...prq, order_number: idx } as CmsPeerOrSelfReviewQuestion
        }),
    )
  }

  const { control: reviewToggleControl } = useAttributeForm<ReviewToggleValues>(
    {
      needsPeerReview: peerReviewEnabled,
      needsSelfReview: selfReviewEnabled,
      useCourseDefaultConfig: Boolean(exerciseAttributes.use_course_default_peer_review),
    },
    (values, changedName) => {
      switch (changedName) {
        case "needsPeerReview":
          setExerciseAttributes({ needs_peer_review: values.needsPeerReview })
          break
        case "needsSelfReview":
          setExerciseAttributes({ needs_self_review: values.needsSelfReview })
          break
        case "useCourseDefaultConfig":
          toggleUseDefaultPeerOrSelfReviewConfig(values.useCourseDefaultConfig)
          break
      }
    },
  )

  const { control: configControl } = useAttributeForm<ReviewConfigValues>(
    {
      peerReviewsToReceive: String(parsedPeerOrSelfReviewConfig.peer_reviews_to_receive),
      peerReviewsToGive: String(parsedPeerOrSelfReviewConfig.peer_reviews_to_give),
      processingStrategy: parsedPeerOrSelfReviewConfig.processing_strategy,
      pointsAreAllOrNothing: parsedPeerOrSelfReviewConfig.points_are_all_or_nothing,
      resetAnswerIfZeroPoints: parsedPeerOrSelfReviewConfig.reset_answer_if_zero_points_from_review,
      acceptingThreshold: String(parsedPeerOrSelfReviewConfig.accepting_threshold),
    },
    (values, changedName) =>
      handlePeerReviewValueChange(
        String(values[changedName]),
        CONFIG_FIELD_BY_FORM_FIELD[changedName],
      ),
  )

  return (
    <QueryResult query={defaultCmsPeerOrSelfReviewConfig}>
      {(defaultCmsPeerOrSelfReviewConfigData) => (
        <div className={reviewSettingsCss}>
          {!courseGlobalEditor && (
            <>
              <Checkbox
                name="needsPeerReview"
                control={reviewToggleControl}
                label={t("add-peer-review")}
                isDisabled={chapterLockingEnabled}
              />
              <Checkbox
                name="needsSelfReview"
                control={reviewToggleControl}
                label={t("add-self-review")}
                isDisabled={chapterLockingEnabled}
              />
              {chapterLockingEnabled && (
                <p
                  className={css`
                    margin: 0.5rem 0 0 0;
                    font-size: 0.875rem;
                    color: ${baseTheme.colors.gray[600]};
                    font-style: italic;
                  `}
                >
                  {t("peer-review-disabled-for-locking-chapters")}
                </p>
              )}
            </>
          )}
          {(peerReviewEnabled || selfReviewEnabled) && (
            <div className={reviewSettingsCss}>
              {!courseGlobalEditor && (
                <Checkbox
                  name="useCourseDefaultConfig"
                  control={reviewToggleControl}
                  label={t("use-course-default-peer-review-config")}
                />
              )}
              {exerciseAttributes.use_course_default_peer_review && (
                <div>
                  <Link
                    href={editCourseDefaultPeerOrSelfReviewConfigRoute(
                      defaultCmsPeerOrSelfReviewConfigData.peer_or_self_review_config.course_id,
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("link-course-default-peer-review-config")}
                  </Link>
                </div>
              )}
              {!exerciseAttributes.use_course_default_peer_review && (
                <Wrapper>
                  <div
                    className={css`
                      display: flex;
                      gap: var(--space-3);
                    `}
                  >
                    <TextField
                      name="peerReviewsToReceive"
                      control={configControl}
                      className={css`
                        width: 100%;
                      `}
                      type="number"
                      min={0}
                      label={t("peer-reviews-to-receive")}
                      isRequired
                    />
                    <TextField
                      name="peerReviewsToGive"
                      control={configControl}
                      className={css`
                        width: 100%;
                      `}
                      type="number"
                      min={0}
                      isRequired
                      label={t("peer-reviews-to-give")}
                    />
                  </div>
                  {parsedPeerOrSelfReviewConfig.peer_reviews_to_receive >=
                    parsedPeerOrSelfReviewConfig.peer_reviews_to_give && (
                    <p
                      className={css`
                        margin: 0;
                        font-size: 1.125rem;
                        color: ${baseTheme.colors.crimson[700]};
                      `}
                    >
                      {t("peer-reviews-to-receive-and-give-error-message")}
                    </p>
                  )}
                  <Select
                    name="processingStrategy"
                    control={configControl}
                    id={`peer-review-processing-strategy-${id}`}
                    label={t("peer-review-processing-strategy")}
                    options={peerReviewProcessingStrategyOptions}
                  />
                  <Checkbox
                    name="pointsAreAllOrNothing"
                    control={configControl}
                    label={t("label-points-are-all-or-nothing")}
                    isDisabled={
                      parsedPeerOrSelfReviewConfig.processing_strategy === "ManualReviewEverything"
                    }
                  />
                  <Checkbox
                    name="resetAnswerIfZeroPoints"
                    control={configControl}
                    label={t("label-reset-answer-if-zero")}
                    isDisabled={
                      parsedPeerOrSelfReviewConfig.processing_strategy ===
                        "ManualReviewEverything" ||
                      parsedPeerOrSelfReviewConfig.processing_strategy ===
                        "AutomaticallyGradeOrManualReviewByAverage"
                    }
                  />
                  {!parsedPeerOrSelfReviewConfig.points_are_all_or_nothing && (
                    <div
                      className={css`
                        padding: 1rem;
                        background-color: ${baseTheme.colors.red[100]};
                        color: ${baseTheme.colors.red[700]};
                      `}
                    >
                      {t("warning-points-are-all-or-nothing-disabled")}
                    </div>
                  )}
                  <TextField
                    name="acceptingThreshold"
                    control={configControl}
                    label={t("peer-review-accepting-threshold")}
                    type="number"
                    step="0.01"
                    min={0}
                    isRequired
                    isDisabled={
                      parsedPeerOrSelfReviewConfig.processing_strategy === "ManualReviewEverything"
                    }
                  />
                  <h2>{t("title-additional-review-instructions")}</h2>
                  {instructionsEditor}
                  <h2>{t("configure-review-answers-option")}</h2>
                  {parsedPeerOrSelfReviewQuestionConfig &&
                    parsedPeerOrSelfReviewQuestionConfig
                      .toSorted((o1, o2) => o1.order_number - o2.order_number)
                      .map((question) => (
                        <QuestionRow
                          key={question.id}
                          question={question}
                          typeOptions={peerOrSelfReviewQuestionTypeoptions}
                          showWeight={
                            parsedPeerOrSelfReviewConfig?.points_are_all_or_nothing === false
                          }
                          onChange={(change) =>
                            handlePeerOrSelfReviewQuestionValueChange(question.id, change)
                          }
                          onDelete={() => deletePeerOrSelfReviewQuestion(question.id)}
                        />
                      ))}
                  <Button
                    variant="primary"
                    size="medium"
                    className={css`
                      align-self: flex-start;
                    `}
                    onClick={() => {
                      if (parsedPeerOrSelfReviewConfig) {
                        addPeerOrSelfReviewQuestion(parsedPeerOrSelfReviewConfig.id)
                      } else {
                        console.error("Parsed peer review config is null")
                      }
                    }}
                  >
                    {t("add-peer-review-question")}
                  </Button>
                </Wrapper>
              )}
            </div>
          )}
        </div>
      )}
    </QueryResult>
  )
}

function defaultPeerOrSelfReviewConfig(
  exerciseId: string | null | undefined,
  courseId: string,
): CmsPeerOrSelfReviewConfig {
  return {
    id: v4(),
    exercise_id: exerciseId ? exerciseId : null,
    course_id: courseId,
    // oxlint-disable-next-line i18next/no-literal-string
    processing_strategy: "AutomaticallyGradeOrManualReviewByAverage",
    accepting_threshold: 2.1,
    peer_reviews_to_give: 3,
    peer_reviews_to_receive: 2,
    points_are_all_or_nothing: true,
    reset_answer_if_zero_points_from_review: false,
    review_instructions: [],
  }
}

export default PeerReviewEditor
