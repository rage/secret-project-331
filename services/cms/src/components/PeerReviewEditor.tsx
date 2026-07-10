"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { XmarkCircle } from "@vectopus/atlas-icons-react"
import React, { useEffect, useLayoutEffect, useMemo, useRef } from "react"
import { v4 } from "uuid"

import type { ExerciseAttributes } from "../blocks/Exercise"

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
import Button from "@/shared-module/common/components/Button"
import CheckBox from "@/shared-module/common/components/InputFields/CheckBox"
import SelectField from "@/shared-module/common/components/InputFields/SelectField"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import { baseTheme } from "@/shared-module/common/styles"
import { editCourseDefaultPeerOrSelfReviewConfigRoute } from "@/shared-module/common/utils/routes"
import { QueryResult } from "@/shared-module/components/components/queryResult/QueryResult"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"
import { useTranslation } from "@/utils/useCmsTranslation"

const Wrapper = styled.div`
  margin: 0 auto;
  max-width: 1000px;
  height: 100%;
  span {
    display: inline-block;
    font-size: 18px;
    margin-bottom: 10px;
    color: #1a2333;
  }
  h2 {
    font-weight: 300;
    font-size: 1.7rem;
    line-height: 1.2;
    margin-top: 10px;
  }
`

const DeleteBtn = styled.button`
  width: 50px;
  min-height: 50px;
  background: #e2c2bc;
  outline: none;
  justify-self: end;
  border: none;
  @media (max-width: 767.98px) {
    width: 100%;
  }
`
const List = styled.div`
  display: grid;
  grid-template-columns: 0.5fr 1.2fr 0.1fr 0.1fr;
  min-height: 40px;
  gap: 10px;
  margin-top: 10px;
  margin-bottom: 10px;
  font-size: 20px;
  @media (max-width: 767.98px) {
    grid-template-columns: 100%;
    gap: 5px;
    margin-bottom: 30px;
  }
`
const StyledQuestion = styled.div`
  background: #f5f6f7;
  border: 1.5px solid #e2e4e6;
  width: 100%;
  padding: 0.4rem 1rem;
  border-radius: 3px;
  @media (max-width: 767.98px) {
    width: 100%;
  }
`
const StyledSelectField = styled(SelectField)`
  @media (max-width: 767.98px) {
    margin-bottom: 10px;
  }
`
const StyledQuestionType = styled.div`
  background: #f5f6f7;
  border: 1.5px solid #e2e4e6;
  border-radius: 3px;
  width: 100%;
  padding: 0.4rem 1rem;
  @media (max-width: 767.98px) {
    width: 100%;
  }
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
      isReady: (courseId): courseId is string => Boolean(courseId),
      build: (courseId) =>
        getCmsCourseOptions({
          path: {
            course_id: courseId,
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
      isReady: (courseId): courseId is string => Boolean(courseId),
      build: (courseId) =>
        getCmsCourseDefaultPeerReviewOptions({
          path: {
            course_id: courseId,
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
      (exerciseAttributes.peer_or_self_review_config == null ||
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
    id: string,
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>,
    field: keyof CmsPeerOrSelfReviewQuestion,
  ) => {
    const peerOrSelfReviewQuestions: CmsPeerOrSelfReviewQuestion[] =
      peerOrSelfReviewQuestionsRef.current
        .map((prq) => {
          if (prq.id === id) {
            switch (field) {
              case "question":
                return { ...prq, question: event.target.value }
              case "question_type":
                return { ...prq, question_type: event.target.value as PeerOrSelfReviewQuestionType }
              case "answer_required":
                // @ts-expect-error: in this case the event is from a checkbox
                return { ...prq, answer_required: Boolean(event.target.checked) }
              case "weight": {
                let newWeight = Number(event.target.value)
                if (Number.isNaN(newWeight) || newWeight < 0 || newWeight > 1) {
                  newWeight = 0
                }
                return { ...prq, weight: newWeight }
              }
              default:
                return prq
            }
          } else {
            return prq
          }
        })
        .sort((o1, o2) => o1.order_number - o2.order_number)

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

  return (
    <QueryResult query={defaultCmsPeerOrSelfReviewConfig}>
      {(defaultCmsPeerOrSelfReviewConfigData) => (
        <div
          className={css`
            display: block;
          `}
        >
          {!courseGlobalEditor && (
            <>
              <CheckBox
                label={t("add-peer-review")}
                onChangeByValue={(checked, _name) =>
                  setExerciseAttributes({ needs_peer_review: checked })
                }
                checked={peerReviewEnabled}
                disabled={chapterLockingEnabled}
              />
              <CheckBox
                label={t("add-self-review")}
                onChangeByValue={(checked, _name) =>
                  setExerciseAttributes({ needs_self_review: checked })
                }
                checked={selfReviewEnabled}
                disabled={chapterLockingEnabled}
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
            <div>
              {!courseGlobalEditor && (
                <CheckBox
                  label={t("use-course-default-peer-review-config")}
                  onChangeByValue={(checked) => toggleUseDefaultPeerOrSelfReviewConfig(checked)}
                  checked={exerciseAttributes.use_course_default_peer_review}
                />
              )}
              {exerciseAttributes.use_course_default_peer_review && (
                <div>
                  <a
                    href={editCourseDefaultPeerOrSelfReviewConfigRoute(
                      defaultCmsPeerOrSelfReviewConfigData.peer_or_self_review_config.course_id,
                    )}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {t("link-course-default-peer-review-config")}
                  </a>
                </div>
              )}
              {!exerciseAttributes.use_course_default_peer_review && (
                <Wrapper>
                  <div
                    className={css`
                      display: flex;
                      gap: 5px 5px;
                      justify-content: space-between;

                      h2 {
                        margin-bottom: 2rem;
                      }
                    `}
                  >
                    <TextField
                      className={css`
                        width: 100%;
                      `}
                      type={"number"}
                      min={0}
                      label={t("peer-reviews-to-receive")}
                      required
                      value={parsedPeerOrSelfReviewConfig.peer_reviews_to_receive}
                      onChangeByValue={(value) => {
                        // oxlint-disable-next-line i18next/no-literal-string
                        handlePeerReviewValueChange(value, "peer_reviews_to_receive")
                      }}
                    />
                    <TextField
                      className={css`
                        width: 100%;
                      `}
                      type={"number"}
                      min={0}
                      required
                      value={parsedPeerOrSelfReviewConfig.peer_reviews_to_give}
                      label={t("peer-reviews-to-give")}
                      onChangeByValue={(value) =>
                        // oxlint-disable-next-line i18next/no-literal-string
                        handlePeerReviewValueChange(value, "peer_reviews_to_give")
                      }
                    />
                  </div>
                  <p
                    className={css`
                      font-size: 1.5em !important;
                      color: ${baseTheme.colors.crimson[700]};
                      width: 100%;
                    `}
                  >
                    {parsedPeerOrSelfReviewConfig.peer_reviews_to_receive >=
                      parsedPeerOrSelfReviewConfig.peer_reviews_to_give &&
                      t("peer-reviews-to-receive-and-give-error-message")}
                  </p>
                  <SelectField
                    id={`peer-review-processing-strategy-${id}`}
                    label={t("peer-review-processing-strategy")}
                    onChangeByValue={(value) => {
                      // oxlint-disable-next-line i18next/no-literal-string
                      handlePeerReviewValueChange(value, "processing_strategy")
                    }}
                    options={peerReviewProcessingStrategyOptions}
                    defaultValue={parsedPeerOrSelfReviewConfig.processing_strategy}
                  />
                  <CheckBox
                    label={t("label-points-are-all-or-nothing")}
                    checked={parsedPeerOrSelfReviewConfig.points_are_all_or_nothing}
                    onChangeByValue={(checked) =>
                      // oxlint-disable-next-line i18next/no-literal-string
                      handlePeerReviewValueChange(checked.toString(), "points_are_all_or_nothing")
                    }
                    disabled={
                      parsedPeerOrSelfReviewConfig.processing_strategy === "ManualReviewEverything"
                    }
                  />
                  <CheckBox
                    label={t("label-reset-answer-if-zero")}
                    checked={parsedPeerOrSelfReviewConfig.reset_answer_if_zero_points_from_review}
                    onChangeByValue={(checked) =>
                      handlePeerReviewValueChange(
                        checked.toString(),
                        // oxlint-disable-next-line i18next/no-literal-string
                        "reset_answer_if_zero_points_from_review",
                      )
                    }
                    disabled={
                      parsedPeerOrSelfReviewConfig.processing_strategy ===
                        "ManualReviewEverything" ||
                      parsedPeerOrSelfReviewConfig.processing_strategy ===
                        "AutomaticallyGradeOrManualReviewByAverage"
                    }
                  />
                  {!parsedPeerOrSelfReviewConfig.points_are_all_or_nothing && (
                    <div
                      className={css`
                        margin-bottom: 1rem;
                        padding: 1rem;
                        background-color: ${baseTheme.colors.red[100]};
                        color: ${baseTheme.colors.red[700]};
                      `}
                    >
                      {t("warning-points-are-all-or-nothing-disabled")}
                    </div>
                  )}
                  <TextField
                    label={t("peer-review-accepting-threshold")}
                    type={"number"}
                    step="0.01"
                    min={0}
                    required
                    disabled={
                      parsedPeerOrSelfReviewConfig.processing_strategy === "ManualReviewEverything"
                    }
                    value={parsedPeerOrSelfReviewConfig.accepting_threshold}
                    onChangeByValue={(value) => {
                      // oxlint-disable-next-line i18next/no-literal-string
                      handlePeerReviewValueChange(value, "accepting_threshold")
                    }}
                  />
                  <h2>{t("title-additional-review-instructions")}</h2>
                  {instructionsEditor}
                  <h2>{t("configure-review-answers-option")}</h2>
                  {parsedPeerOrSelfReviewQuestionConfig &&
                    parsedPeerOrSelfReviewQuestionConfig
                      .sort((o1, o2) => o1.order_number - o2.order_number)
                      .map(({ id, question, question_type, answer_required, weight }) => (
                        <List key={id} id={id}>
                          <StyledQuestion>
                            <StyledSelectField
                              label={t("peer-review-question-type")}
                              onChange={(e) => {
                                // oxlint-disable-next-line i18next/no-literal-string
                                handlePeerOrSelfReviewQuestionValueChange(id, e, "question_type")
                              }}
                              defaultValue={question_type}
                              options={peerOrSelfReviewQuestionTypeoptions}
                              id={`peer-review-question-${id}`}
                              onBlur={() => null}
                            />
                            {question_type === "Scale" &&
                              parsedPeerOrSelfReviewConfig?.points_are_all_or_nothing === false && (
                                <TextField
                                  label={t("label-weight")}
                                  type="number"
                                  min={0}
                                  max={1}
                                  step={0.01}
                                  value={weight}
                                  onChange={(e) => {
                                    // oxlint-disable-next-line i18next/no-literal-string
                                    handlePeerOrSelfReviewQuestionValueChange(id, e, "weight")
                                  }}
                                  className={css`
                                    margin-bottom: 0;
                                  `}
                                />
                              )}
                          </StyledQuestion>
                          <StyledQuestionType>
                            <TextAreaField
                              label={t("peer-review-question")}
                              onChange={(event) => {
                                // oxlint-disable-next-line i18next/no-literal-string
                                handlePeerOrSelfReviewQuestionValueChange(id, event, "question")
                              }}
                              defaultValue={question}
                              autoResize={true}
                            />
                          </StyledQuestionType>
                          <StyledQuestion>
                            {question_type !== "Scale" ? (
                              <CheckBox
                                label={t("answer-required")}
                                checked={answer_required}
                                className={css`
                                  margin-top: 0.5rem;
                                `}
                                onChange={(e) =>
                                  handlePeerOrSelfReviewQuestionValueChange(
                                    id,
                                    e,
                                    // oxlint-disable-next-line i18next/no-literal-string
                                    "answer_required",
                                  )
                                }
                              />
                            ) : (
                              <div
                                className={css`
                                  min-width: 93px;
                                `}
                              >
                                {/* oxlint-disable-next-line i18next/no-literal-string */}
                                &nbsp;
                              </div>
                            )}
                          </StyledQuestion>
                          <DeleteBtn
                            aria-label={t("delete")}
                            onClick={() => deletePeerOrSelfReviewQuestion(id)}
                            className={css`
                              display: flex;
                              justify-content: center;
                              align-items: center;
                            `}
                          >
                            <XmarkCircle />
                          </DeleteBtn>
                        </List>
                      ))}
                  <Button
                    variant="primary"
                    size="medium"
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
