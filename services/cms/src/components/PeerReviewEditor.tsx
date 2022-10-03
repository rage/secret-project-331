/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faXmark } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useQuery } from "@tanstack/react-query"
import React, { useEffect } from "react"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { ExerciseAttributes } from "../blocks/Exercise"
import { getCoursesDefaultCmsPeerReviewConfiguration } from "../services/backend/courses"
import {
  CmsPeerReviewConfig,
  CmsPeerReviewQuestion,
  PeerReviewAcceptingStrategy,
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

const HEADING_TEXT = "Configure review answers option"

export interface PeerReviewEditorExtraProps {
  attributes: Readonly<Partial<ExerciseAttributes>>
  setAttributes: (attr: Partial<ExerciseAttributes>) => void
  exerciseId?: string
  courseId: string
  courseGlobalEditor: boolean
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
}) => {
  const { t } = useTranslation()
  const peerReviewEnabled = exerciseAttributes.needs_peer_review ?? false

  // const [usePeerReview, setUsePeerReview] = useState(attributes.needs_peer_review)
  // const [useDefaultPeerReview, setUseDefaultPeerReview] = useState(
  //   /// If undefined or null, defaults to false
  //   attributes.use_course_default_peer_review === false,
  // )

  useEffect(() => {
    if (
      exerciseAttributes.use_course_default_peer_review === undefined ||
      exerciseAttributes.use_course_default_peer_review === null
    ) {
      setExerciseAttributes({ use_course_default_peer_review: true })
    }
  })

  const defaultCmsPeerReviewConfig = useQuery(
    [`course-default-peer-review-config-${courseId}`],
    () => getCoursesDefaultCmsPeerReviewConfiguration(courseId),
  )

  let parsedPeerReviewConfig: CmsPeerReviewConfig | null = JSON.parse(
    exerciseAttributes.peer_review_config ?? "{}",
  )

  if (parsedPeerReviewConfig === null) {
    const defaultConfig = defaultPeerReviewConfig(exerciseId, courseId)
    parsedPeerReviewConfig = defaultConfig
    setExerciseAttributes({
      ...exerciseAttributes,
      peer_review_config: JSON.stringify(defaultConfig),
    })
  }

  const parsedPeerReviewQuestionConfig: CmsPeerReviewQuestion[] = JSON.parse(
    exerciseAttributes.peer_review_questions_config ?? "[]",
  )

  const peerReviewQuestionTypeoptions: { label: string; value: PeerReviewQuestionType }[] = [
    { label: t("essay"), value: "Essay" },
    { label: t("likert-scale"), value: "Scale" },
  ]

  const peerReviewAcceptingStrategyOptions: {
    label: string
    value: PeerReviewAcceptingStrategy
  }[] = [
    {
      label: "Automatically accept or reject by average",
      value: "AutomaticallyAcceptOrRejectByAverage",
    },
    {
      label: "Automatically accept or manual review by average",
      value: "AutomaticallyAcceptOrManualReviewByAverage",
    },
    {
      label: "Manual review everything",
      value: "ManualReviewEverything",
    },
  ]

  const handlePeerReviewValueChange = (value: any, field: keyof CmsPeerReviewConfig) => {
    let peerReviewConfig
    switch (field) {
      case "accepting_strategy":
        peerReviewConfig = { ...parsedPeerReviewConfig, accepting_strategy: value }
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
    value: unknown,
    field: keyof CmsPeerReviewQuestion,
  ) => {
    const peerReviewQuestions = parsedPeerReviewQuestionConfig.map((prq) => {
      if (prq.id === id) {
        switch (field) {
          case "question":
            return { ...prq, question: value }
          case "question_type":
            return { ...prq, question_type: value }
          case "answer_required":
            return { ...prq, answer_required: value }
          default:
            break
        }
      } else {
        return prq
      }
    })
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
      accepting_strategy: "AutomaticallyAcceptOrManualReviewByAverage",
      accepting_threshold: 2.1,
      peer_reviews_to_give: 3,
      peer_reviews_to_receive: 2,
    }
    setExerciseAttributes({
      ...exerciseAttributes,
      peer_review_config: checked ? JSON.stringify(prc) : "{}",
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
        },
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

  if (defaultCmsPeerReviewConfig.isLoading) {
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
            onChange={(checked, _name) => toggleUsePeerReviewConfig(checked)}
            checked={peerReviewEnabled}
          />
        )}
        {peerReviewEnabled && (
          <div>
            {!courseGlobalEditor && (
              <CheckBox
                label={t("use-course-default-peer-review-config")}
                onChange={(checked) => toggleUseDefaultPeerReviewConfig(checked)}
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
                  Course default peer review config
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
                    onChange={(e) => {
                      handlePeerReviewValueChange(e, "peer_reviews_to_receive")
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
                    onChange={(e) => handlePeerReviewValueChange(e, "peer_reviews_to_give")}
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
                  id={`peer-review-accepting-strategy-${id}`}
                  label={t("peer-review-accepting-strategy")}
                  onChange={(e) => {
                    handlePeerReviewValueChange(e, "accepting_strategy")
                  }}
                  options={peerReviewAcceptingStrategyOptions}
                  defaultValue={parsedPeerReviewConfig.accepting_strategy}
                />
                <TextField
                  label={t("peer-review-accepting-threshold")}
                  type={"number"}
                  step="0.01"
                  min={0}
                  required
                  value={parsedPeerReviewConfig.accepting_threshold}
                  onChange={(e) => {
                    handlePeerReviewValueChange(e, "accepting_threshold")
                  }}
                />
                <h2>{HEADING_TEXT}</h2>
                {parsedPeerReviewQuestionConfig &&
                  parsedPeerReviewQuestionConfig.map(
                    ({ id, question, question_type, answer_required }) => (
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
                        </StyledQuestion>
                        <StyledQuestionType>
                          <TextAreaField
                            label={t("peer-review-question")}
                            onChange={(e) => {
                              handlePeerReviewQuestionValueChange(id, e, "question")
                            }}
                            defaultValue={question}
                            autoResize={true}
                          />
                        </StyledQuestionType>
                        <StyledQuestion>
                          <CheckBox
                            label={t("answer-required")}
                            checked={answer_required}
                            onChange={(e) =>
                              handlePeerReviewQuestionValueChange(id, e, "answer_required")
                            }
                          />
                        </StyledQuestion>
                        <DeleteBtn
                          aria-label={t("delete")}
                          onClick={() => deletePeerReviewQuestion(id)}
                        >
                          <FontAwesomeIcon icon={faXmark} />
                        </DeleteBtn>
                      </List>
                    ),
                  )}
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
    accepting_strategy: "AutomaticallyAcceptOrManualReviewByAverage",
    accepting_threshold: 2.1,
    peer_reviews_to_give: 3,
    peer_reviews_to_receive: 2,
  }
}

export default PeerReviewEditor
