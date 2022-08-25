/* eslint-disable i18next/no-literal-string */
import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { faXmark } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { getCoursesDefaultCmsPeerReviewConfiguration } from "../services/backend/courses"
import {
  CmsPeerReviewConfig,
  CmsPeerReviewQuestion,
  PeerReviewAcceptingStrategy,
  PeerReviewQuestion,
  PeerReviewQuestionType,
} from "../shared-module/bindings"
import { isCmsPeerReviewConfig } from "../shared-module/bindings.guard"
import Button from "../shared-module/components/Button"
import ErrorBanner from "../shared-module/components/ErrorBanner"
import CheckBox from "../shared-module/components/InputFields/CheckBox"
import SelectField from "../shared-module/components/InputFields/SelectField"
import TextAreaField from "../shared-module/components/InputFields/TextAreaField"
import TextField from "../shared-module/components/InputFields/TextField"
import Spinner from "../shared-module/components/Spinner"

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
  grid-template-columns: 0.5fr 1.2fr 0.1fr;
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
  attributes: any
  setAttributes: (attr: any) => void
  exerciseId?: string
  courseId: string
}

export type PeerReviewEditorProps = React.HTMLAttributes<HTMLDivElement> &
  PeerReviewEditorExtraProps

const PeerReviewEditor: React.FC<PeerReviewEditorProps> = ({
  id,
  exerciseId,
  courseId,
  attributes,
  setAttributes,
}) => {
  const { t } = useTranslation()

  const [usePeerReview, setUsePeerReview] = useState(
    isCmsPeerReviewConfig(JSON.parse(attributes.peer_review_config) as CmsPeerReviewConfig),
  )
  const [useDefaultPeerReview, setUseDefaultPeerReview] = useState(
    attributes.use_course_default_peer_review,
  )

  const defaultCmsPeerReviewConfig = useQuery(
    [`course-default-peer-review-config-${courseId}`],
    () => getCoursesDefaultCmsPeerReviewConfiguration(courseId),
  )

  const parsedPeerReview = JSON.parse(attributes.peer_review_config) as CmsPeerReviewConfig

  const parsedPeerReviewQuestion = JSON.parse(
    attributes.peer_review_questions_config,
  ) as CmsPeerReviewQuestion[]

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
        peerReviewConfig = {
          ...parsedPeerReview,
          accepting_strategy: value as PeerReviewAcceptingStrategy,
        }
        break
      case "accepting_threshold":
        peerReviewConfig = { ...parsedPeerReview, accepting_threshold: Number(value) }
        break
      case "peer_reviews_to_give":
        peerReviewConfig = { ...parsedPeerReview, peer_reviews_to_give: Number(value) }
        break
      case "peer_reviews_to_receive":
        peerReviewConfig = { ...parsedPeerReview, peer_reviews_to_receive: Number(value) }
        break
      default:
        break
    }
    setAttributes({
      peer_review_config: JSON.stringify(peerReviewConfig),
      peer_review_questions_config: JSON.stringify(parsedPeerReviewQuestion),
    })
  }

  const handlePeerReviewQuestionValueChange = (
    id: string,
    value: any,
    field: keyof CmsPeerReviewQuestion,
  ) => {
    const peerReviewQuestions = parsedPeerReviewQuestion.map((prq) => {
      if (prq.id === id) {
        switch (field) {
          case "question":
            return { ...prq, question: value }
          case "question_type":
            return { ...prq, question_type: value }
          default:
            break
        }
      } else {
        return prq
      }
    })
    setAttributes({
      peer_review_config: JSON.stringify(parsedPeerReview),
      peer_review_questions_config: JSON.stringify(peerReviewQuestions),
    })
  }

  const toggleUsePeerReviewConfig = (checked: boolean) => {
    setUsePeerReview(checked)
    setAttributes({
      peer_review_config: checked
        ? JSON.stringify({
            id: v4(),
            course_id: courseId,
            exercise_id: exerciseId,
            accepting_strategy: "ManualReviewEverything",
            accepting_threshold: 1,
            peer_reviews_to_give: 2,
            peer_reviews_to_receive: 1,
          } as CmsPeerReviewConfig)
        : "{}",
      peer_review_questions_config: "[]",
      use_course_default_peer_review: false,
      need_peer_review: checked,
    })
  }

  const toggleUseDefaultPeerReviewConfig = (checked: boolean) => {
    setUseDefaultPeerReview(checked)
    const prc = JSON.stringify({
      ...(JSON.parse(attributes.peer_review_config) as CmsPeerReviewConfig),
      exercise_id: checked ? null : exerciseId,
    } as CmsPeerReviewConfig)

    setAttributes({
      use_course_default_peer_review: checked,
      peer_review_config: checked ? "{}" : prc,
      peer_review_questions_config: "[]",
    })
  }

  const addPeerReviewQuestion = (peerReviewId: string) => {
    setAttributes({
      peer_review_questions_config: JSON.stringify([
        ...parsedPeerReviewQuestion,
        {
          id: v4(),
          question: "Insert question here",
          question_type: "Essay",
          peer_review_config_id: peerReviewId,
          answer_required: true,
          order_number: parsedPeerReviewQuestion.length,
        },
      ]),
      peer_review_config: JSON.stringify(parsedPeerReview),
    })
  }

  const deletePeerReviewQuestion = (peerReviewQuestionId: string) => {
    setAttributes({
      peer_review_questions_config: JSON.stringify(
        parsedPeerReviewQuestion
          .filter((x) => x.id !== peerReviewQuestionId)
          .map((prq, idx) => {
            return { ...prq, order_number: idx } as PeerReviewQuestion
          }),
      ),
      peer_review_config: JSON.stringify(parsedPeerReview),
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
        <CheckBox
          label={t("add-peer-review")}
          onChange={(checked, _name) => toggleUsePeerReviewConfig(checked)}
          checked={usePeerReview}
        />
        {usePeerReview && (
          <div>
            <CheckBox
              label={t("use-course-global-peer-review")}
              onChange={(checked) => toggleUseDefaultPeerReviewConfig(checked)}
              checked={useDefaultPeerReview}
            />
            {useDefaultPeerReview && (
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
            {!useDefaultPeerReview && (
              <Wrapper>
                <div
                  className={css`
                    display: flex;
                  `}
                >
                  <TextField
                    className={css`
                      width: 100%;
                      margin-right: 0.5rem;
                    `}
                    type={"number"}
                    min={0}
                    label={t("peer-reviews-to-receive")}
                    required
                    value={parsedPeerReview.peer_reviews_to_receive}
                    onChange={(e) => {
                      handlePeerReviewValueChange(e, "peer_reviews_to_receive")
                    }}
                  />
                  <TextField
                    className={css`
                      width: 100%;
                      margin-left: 0.5rem;
                    `}
                    type={"number"}
                    min={0}
                    required
                    value={parsedPeerReview.peer_reviews_to_give}
                    label={t("peer-reviews-to-give")}
                    onChange={(e) => handlePeerReviewValueChange(e, "peer_reviews_to_give")}
                  />
                </div>
                <SelectField
                  id={`peer-review-accepting-strategy-${id}`}
                  label={t("peer-review-accepting-strategy")}
                  onBlur={() => null}
                  onChange={(e) => {
                    handlePeerReviewValueChange(e, "accepting_strategy")
                  }}
                  options={peerReviewAcceptingStrategyOptions}
                />
                <TextField
                  label={t("peer-review-accepting-threshold")}
                  type={"number"}
                  step="0.01"
                  min={0}
                  required
                  value={parsedPeerReview.accepting_threshold}
                  onChange={(e) => {
                    handlePeerReviewValueChange(e, "accepting_threshold")
                  }}
                />

                <h2>{HEADING_TEXT}</h2>
                {parsedPeerReviewQuestion &&
                  parsedPeerReviewQuestion.map(({ id, question, question_type }) => (
                    <List key={id} id={id}>
                      <StyledQuestion>
                        <StyledSelectField
                          label="Peer review question type"
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
                          label="Peer review question"
                          onChange={(e) => {
                            handlePeerReviewQuestionValueChange(id, e, "question")
                          }}
                          defaultValue={question}
                          autoResize={true}
                        />
                      </StyledQuestionType>
                      <DeleteBtn
                        aria-label={t("delete")}
                        onClick={() => deletePeerReviewQuestion(id)}
                      >
                        <FontAwesomeIcon icon={faXmark} />
                      </DeleteBtn>
                    </List>
                  ))}
                <Button
                  variant="primary"
                  size="medium"
                  onClick={() => addPeerReviewQuestion(parsedPeerReview.id)}
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

export default PeerReviewEditor
