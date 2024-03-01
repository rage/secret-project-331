import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { useQuery } from "@tanstack/react-query"
import { XmarkCircle } from "@vectopus/atlas-icons-react"
import React, { useEffect, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { ExerciseAttributes } from "../blocks/Exercise"
import { getCoursesDefaultCmsPeerReviewConfiguration } from "../services/backend/courses"
import {
  CmsPeerReviewConfig,
  CmsPeerReviewQuestion,
  PeerReviewProcessingStrategy,
  PeerReviewQuestion,
  PeerReviewQuestionType,
} from "../shared-module/bindings"
import Button from "../shared-module/components/Button"
import ErrorBanner from "../shared-module/components/ErrorBanner"
import CheckBox from "../shared-module/components/InputFields/CheckBox"
import SelectField from "../shared-module/components/InputFields/SelectField"
import TextAreaField from "../shared-module/components/InputFields/TextAreaField"
import TextField from "../shared-module/components/InputFields/TextField"
import Spinner from "../shared-module/components/Spinner"
import { baseTheme } from "../shared-module/styles"

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

  useEffect(() => {
    if (
      exerciseAttributes.use_course_default_peer_review === undefined ||
      exerciseAttributes.use_course_default_peer_review === null
    ) {
      setExerciseAttributes({ use_course_default_peer_review: true })
    }
  })

  const defaultCmsPeerReviewConfig = useQuery({
    queryKey: [`course-default-peer-review-config-${courseId}`],
    queryFn: () => getCoursesDefaultCmsPeerReviewConfiguration(courseId),
  })

  let parsedPeerReviewConfig: CmsPeerReviewConfig | null = JSON.parse(
    exerciseAttributes.peer_review_config ?? "null",
  )

  if (parsedPeerReviewConfig === null) {
    const defaultConfig = defaultPeerReviewConfig(exerciseId, courseId)
    parsedPeerReviewConfig = defaultConfig
    setExerciseAttributes({
      ...exerciseAttributes,
      peer_review_config: JSON.stringify(defaultConfig),
    })
  }

  const parsedPeerReviewQuestionConfig: CmsPeerReviewQuestion[] = useMemo(() => {
    const res = JSON.parse(exerciseAttributes.peer_review_questions_config ?? "[]")
    if (res === null || res === undefined) {
      return []
    }
    return res
  }, [exerciseAttributes.peer_review_questions_config])

  const peerReviewQuestionTypeoptions: { label: string; value: PeerReviewQuestionType }[] = [
    { label: t("essay"), value: "Essay" },
    { label: t("likert-scale"), value: "Scale" },
  ]

  const peerReviewProcessingStrategyOptions: {
    label: string
    value: PeerReviewProcessingStrategy
  }[] = [
    {
      label: "Automatically grade by average",
      value: "AutomaticallyGradeByAverage",
    },
    {
      label: "Automatically grade or manual review by average",
      value: "AutomaticallyGradeOrManualReviewByAverage",
    },
    {
      label: "Manual review everything",
      value: "ManualReviewEverything",
    },
  ]

  const handlePeerReviewValueChange = (value: string, field: keyof CmsPeerReviewConfig) => {
    let peerReviewConfig
    switch (field) {
      case "processing_strategy":
        peerReviewConfig = { ...parsedPeerReviewConfig, processing_strategy: value }
        break
      case "accepting_threshold":
        peerReviewConfig = { ...parsedPeerReviewConfig, accepting_threshold: Number(value) }
        break
      case "peer_reviews_to_give":
        peerReviewConfig = { ...parsedPeerReviewConfig, peer_reviews_to_give: Number(value) }
        break
      case "peer_reviews_to_receive":
        peerReviewConfig = { ...parsedPeerReviewConfig, peer_reviews_to_receive: Number(value) }
        break
      case "points_are_all_or_nothing":
        peerReviewConfig = {
          ...parsedPeerReviewConfig,
          points_are_all_or_nothing: value === "true",
        }
        break
      default:
        break
    }
    setExerciseAttributes({
      ...exerciseAttributes,
      peer_review_config: JSON.stringify(peerReviewConfig),
      peer_review_questions_config: JSON.stringify(parsedPeerReviewQuestionConfig),
    })
  }

  const handlePeerReviewQuestionValueChange = (
    id: string,
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement | HTMLSelectElement>,
    field: keyof CmsPeerReviewQuestion,
  ) => {
    const peerReviewQuestions: CmsPeerReviewQuestion[] = parsedPeerReviewQuestionConfig
      .map((prq) => {
        if (prq.id === id) {
          switch (field) {
            case "question":
              return { ...prq, question: event.target.value }
            case "question_type":
              return { ...prq, question_type: event.target.value as PeerReviewQuestionType }
            case "answer_required":
              // @ts-expect-error: in this case the event is from a checkbox
              return { ...prq, answer_required: Boolean(event.target.checked) }
            case "weight": {
              let newWeight = Number(event.target.value)
              if (newWeight < 0 || newWeight > 1) {
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

    setExerciseAttributes({
      ...exerciseAttributes,
      peer_review_config: JSON.stringify(parsedPeerReviewConfig),
      peer_review_questions_config: JSON.stringify(peerReviewQuestions),
    })
  }

  const toggleUsePeerReviewConfig = (checked: boolean) => {
    const prc: CmsPeerReviewConfig = {
      id: v4(),
      course_id: courseId,
      exercise_id: exerciseId ?? null,
      processing_strategy: "AutomaticallyGradeOrManualReviewByAverage",
      accepting_threshold: 2.1,
      peer_reviews_to_give: 3,
      peer_reviews_to_receive: 2,
      points_are_all_or_nothing: true,
      additional_review_instructions: [],
    }
    setExerciseAttributes({
      ...exerciseAttributes,
      peer_review_config: checked ? JSON.stringify(prc) : "null",
      peer_review_questions_config: "[]",
      use_course_default_peer_review: true,
      needs_peer_review: checked,
    })
  }

  const toggleUseDefaultPeerReviewConfig = (checked: boolean) => {
    const prc = defaultPeerReviewConfig(exerciseId, courseId)

    setExerciseAttributes({
      ...exerciseAttributes,
      use_course_default_peer_review: checked,
      peer_review_config: checked ? "null" : JSON.stringify(prc),
      peer_review_questions_config: checked ? "null" : "[]",
    })
  }

  const addPeerReviewQuestion = (peerReviewId: string) => {
    if (exerciseAttributes.peer_review_questions_config === undefined) {
      setExerciseAttributes({ ...exerciseAttributes, peer_review_questions_config: "[]" })
    }
    setExerciseAttributes({
      ...exerciseAttributes,
      peer_review_questions_config: JSON.stringify([
        ...parsedPeerReviewQuestionConfig,
        {
          id: v4(),
          question: "Insert question here",
          question_type: "Essay",
          peer_review_config_id: peerReviewId,
          answer_required: true,
          order_number: parsedPeerReviewQuestionConfig.length,
          weight: 0,
        } satisfies CmsPeerReviewQuestion,
      ]),
      peer_review_config: JSON.stringify(parsedPeerReviewConfig),
    })
  }

  const deletePeerReviewQuestion = (peerReviewQuestionId: string) => {
    setExerciseAttributes({
      ...exerciseAttributes,
      peer_review_questions_config: JSON.stringify(
        parsedPeerReviewQuestionConfig
          .filter((x) => x.id !== peerReviewQuestionId)
          .map((prq, idx) => {
            return { ...prq, order_number: idx } as PeerReviewQuestion
          }),
      ),
      peer_review_config: JSON.stringify(parsedPeerReviewConfig),
    })
  }

  if (defaultCmsPeerReviewConfig.isPending) {
    return <Spinner variant="medium" />
  }

  if (defaultCmsPeerReviewConfig.isError) {
    return <ErrorBanner variant="text" error={defaultCmsPeerReviewConfig.error} />
  }

  return (
    <>
      <div
        className={css`
          display: block;
        `}
      >
        {!courseGlobalEditor && (
          <CheckBox
            label={t("add-peer-review")}
            onChangeByValue={(checked, _name) => toggleUsePeerReviewConfig(checked)}
            checked={peerReviewEnabled}
          />
        )}
        {peerReviewEnabled && (
          <div>
            {!courseGlobalEditor && (
              <CheckBox
                label={t("use-course-default-peer-review-config")}
                onChangeByValue={(checked) => toggleUseDefaultPeerReviewConfig(checked)}
                checked={exerciseAttributes.use_course_default_peer_review}
              />
            )}
            {exerciseAttributes.use_course_default_peer_review && (
              <div>
                <a
                  href={`/cms/courses/${defaultCmsPeerReviewConfig.data.peer_review_config.course_id}/default-peer-review`}
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
                    value={parsedPeerReviewConfig.peer_reviews_to_receive}
                    onChangeByValue={(value) => {
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
                    value={parsedPeerReviewConfig.peer_reviews_to_give}
                    label={t("peer-reviews-to-give")}
                    onChangeByValue={(value) =>
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
                  {parsedPeerReviewConfig.peer_reviews_to_receive >=
                    parsedPeerReviewConfig.peer_reviews_to_give &&
                    t("peer-reviews-to-receive-and-give-error-message")}
                </p>
                <SelectField
                  id={`peer-review-processing-strategy-${id}`}
                  label={t("peer-review-processing-strategy")}
                  onChangeByValue={(value) => {
                    handlePeerReviewValueChange(value, "processing_strategy")
                  }}
                  options={peerReviewProcessingStrategyOptions}
                  defaultValue={parsedPeerReviewConfig.processing_strategy}
                />
                <CheckBox
                  label={t("label-points-are-all-or-nothing")}
                  checked={parsedPeerReviewConfig.points_are_all_or_nothing}
                  onChangeByValue={(checked) =>
                    handlePeerReviewValueChange(checked.toString(), "points_are_all_or_nothing")
                  }
                  disabled={parsedPeerReviewConfig.processing_strategy === "ManualReviewEverything"}
                />
                {!parsedPeerReviewConfig.points_are_all_or_nothing && (
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
                  disabled={parsedPeerReviewConfig.processing_strategy === "ManualReviewEverything"}
                  value={parsedPeerReviewConfig.accepting_threshold}
                  onChangeByValue={(value) => {
                    handlePeerReviewValueChange(value, "accepting_threshold")
                  }}
                />
                <h2>{t("title-additional-review-instructions")}</h2>
                {instructionsEditor}
                <h2>{t("configure-review-answers-option")}</h2>
                {parsedPeerReviewQuestionConfig &&
                  parsedPeerReviewQuestionConfig
                    .sort((o1, o2) => o1.order_number - o2.order_number)
                    .map(({ id, question, question_type, answer_required, weight }) => (
                      <List key={id} id={id}>
                        <StyledQuestion>
                          <StyledSelectField
                            label={t("peer-review-question-type")}
                            onChange={(e) => {
                              handlePeerReviewQuestionValueChange(id, e, "question_type")
                            }}
                            defaultValue={question_type}
                            options={peerReviewQuestionTypeoptions}
                            id={`peer-review-question-${id}`}
                            onBlur={() => null}
                          />
                          {question_type === "Scale" &&
                            parsedPeerReviewConfig?.points_are_all_or_nothing === false && (
                              <TextField
                                label="Weight"
                                type="number"
                                min={0}
                                max={1}
                                step={0.01}
                                value={weight}
                                onChange={(e) => {
                                  handlePeerReviewQuestionValueChange(id, e, "weight")
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
                              handlePeerReviewQuestionValueChange(id, event, "question")
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
                                handlePeerReviewQuestionValueChange(id, e, "answer_required")
                              }
                            />
                          ) : (
                            <div
                              className={css`
                                min-width: 93px;
                              `}
                            >
                              &nbsp;
                            </div>
                          )}
                        </StyledQuestion>
                        <DeleteBtn
                          aria-label={t("delete")}
                          onClick={() => deletePeerReviewQuestion(id)}
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
                    if (parsedPeerReviewConfig) {
                      addPeerReviewQuestion(parsedPeerReviewConfig.id)
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
    </>
  )
}

function defaultPeerReviewConfig(
  exerciseId: string | null | undefined,
  courseId: string,
): CmsPeerReviewConfig {
  return {
    id: v4(),
    exercise_id: exerciseId ? exerciseId : null,
    course_id: courseId,
    processing_strategy: "AutomaticallyGradeOrManualReviewByAverage",
    accepting_threshold: 2.1,
    peer_reviews_to_give: 3,
    peer_reviews_to_receive: 2,
    points_are_all_or_nothing: true,
    additional_review_instructions: [],
  }
}

export default PeerReviewEditor
