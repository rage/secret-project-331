/* eslint-disable i18next/no-literal-string */
import styled from "@emotion/styled"
import { faXmark } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { TextField } from "@mui/material"
import { Spinner } from "@wordpress/components"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import PageContext from "../contexts/PageContext"
import {
  CmsPeerReview,
  CmsPeerReviewQuestion,
  PeerReviewAcceptingStrategy,
  PeerReviewQuestionType,
} from "../shared-module/bindings"
import Button from "../shared-module/components/Button"
import SelectField from "../shared-module/components/InputFields/SelectField"
import TextAreaField from "../shared-module/components/InputFields/TextAreaField"

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

const PLACEHOLDER = "Write the PeerReview instruction"
const QUESTION = "question"
const INSTRUCTION = "instruction"
const TYPE = "questionType"
const QUESTION_PLACEHOLDER = "Write the question"
const HEADING_TEXT = "Configure review answers option"

export interface PeerReviewEditorExtraProps {
  attributes: any
  setAttributes: (attr: any) => void
  exerciseId: string
}

export type PeerReviewEditorProps = React.HTMLAttributes<HTMLDivElement> &
  PeerReviewEditorExtraProps

const PeerReviewEditor: React.FC<PeerReviewEditorProps> = ({
  id,
  exerciseId,
  attributes,
  setAttributes,
}) => {
  const courseId = useContext(PageContext)?.page.course_id

  const { t } = useTranslation()

  const parsedPeerReviews = JSON.parse(attributes.peer_review_config) as CmsPeerReview[]

  const parsedPeerReviewQuestion = JSON.parse(
    attributes.peer_review_questions_config,
  ) as CmsPeerReviewQuestion[]

  const peerReviewQuestionTypeoptions: { label: string; value: PeerReviewQuestionType }[] = [
    { label: t("essay"), value: "Essay" },
    { label: t("linkert-scale"), value: "Scale" },
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

  const handlePeerReviewValueChange = (id: string, value: any, field: keyof CmsPeerReview) => {
    const peerReviews = parsedPeerReviews.map((pr) => {
      if (pr.id === id) {
        switch (field) {
          case "accepting_strategy":
            return { ...pr, accepting_strategy: value as PeerReviewAcceptingStrategy }
          case "accepting_threshold":
            return { ...pr, accepting_threshold: Number(value) }
          case "peer_reviews_to_give":
            return { ...pr, peer_reviews_to_give: Number(value) }
          case "peer_reviews_to_receive":
            return { ...pr, peer_reviews_to_receive: Number(value) }
          default:
            break
        }
      }
    }) as CmsPeerReview[]
    setAttributes({ peer_review_config: JSON.stringify(peerReviews) })
  }

  const handlePeerReviewQuestionValueChnage = (
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
      }
    })
    setAttributes({ peer_review_questions_config: JSON.stringify(peerReviewQuestions) })
  }

  const addPeerReview = () => {
    setAttributes({
      peer_review_config: JSON.stringify([
        ...parsedPeerReviews,
        {
          id: v4(),
          course_id: courseId,
          exercise_id: exerciseId,
          peer_reviews_to_give: 0,
          peer_reviews_to_receive: 0,
          accepting_strategy: "AutomaticallyAcceptOrManualReviewByAverage",
          accepting_threshold: 0,
        },
      ]),
    })
  }

  const addPeerReviewQuestion = (peerReviewId: string) => {
    setAttributes({
      peer_review_questions_config: JSON.stringify([
        ...parsedPeerReviewQuestion,
        {
          id: v4(),
          question: "",
          question_type: "essay",
          peer_review_id: peerReviewId,
          answer_required: true,
          order_number: 0,
        },
      ]),
    })
  }

  const deletePeerReview = (id: string) => {
    setAttributes({
      peer_review_config: JSON.stringify(parsedPeerReviews.filter((x) => x.id !== id)),
    })
  }

  const deletePeerReviewQuestion = (id: string) => {
    setAttributes({
      peer_review_questions_config: JSON.stringify(
        parsedPeerReviewQuestion.filter((x) => x.id !== id),
      ),
    })
  }

  if (!courseId) {
    return <Spinner />
  }
  return (
    <>
      <div>
        <Button variant="primary" size="medium" onClick={addPeerReview}>
          {t("add-peer-review")}
        </Button>
        {parsedPeerReviews.map((pr) => {
          return (
            <div key={pr.id} id={pr.id}>
              <Button variant="secondary" size="medium" onClick={() => deletePeerReview(pr.id)}>
                {t("delete")}
              </Button>
              <Wrapper>
                <span>{t("peer-review-instructions")}</span>
                <TextField name={INSTRUCTION} placeholder={PLACEHOLDER} onChange={() => null} />
                <span>{t("peer-reviews-to-receive")}</span>
                <input
                  type={"number"}
                  min={0}
                  required
                  value={pr.peer_reviews_to_receive}
                  onChange={(e) => {
                    handlePeerReviewValueChange(pr.id, e.target.value, "peer_reviews_to_receive")
                  }}
                />

                <span>{t("peer-reviews-to-give")}</span>
                <input
                  type={"number"}
                  min={0}
                  required
                  value={pr.peer_reviews_to_give}
                  onChange={(e) =>
                    handlePeerReviewValueChange(pr.id, e.target.value, "peer_reviews_to_give")
                  }
                />
                <span>{t("peer-review-accepting-strategy")}</span>
                <SelectField
                  id={`peer-review-accepting-strategy-${id}`}
                  onBlur={() => null}
                  onChange={(e) => {
                    handlePeerReviewValueChange(pr.id, e, "accepting_strategy")
                  }}
                  options={peerReviewAcceptingStrategyOptions}
                />
                <span>{t("peer-review-accepting-threshold")}</span>
                <input
                  type={"number"}
                  step="0.01"
                  min={0}
                  required
                  value={pr.accepting_threshold}
                  onChange={(e) => {
                    handlePeerReviewValueChange(pr.id, e.target.value, "accepting_threshold")
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
                            console.log(e)
                            handlePeerReviewQuestionValueChnage(id, e, "question_type")
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
                            handlePeerReviewQuestionValueChnage(id, e, "question")
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
                  onClick={() => addPeerReviewQuestion(pr.id)}
                >
                  {t("add-peer-review-question")}
                </Button>
              </Wrapper>
            </div>
          )
        })}
      </div>
    </>
  )
}

export default PeerReviewEditor
