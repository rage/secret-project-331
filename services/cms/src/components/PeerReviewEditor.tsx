/* eslint-disable i18next/no-literal-string */
import styled from "@emotion/styled"
import { faXmark } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import { Switch, TextField } from "@mui/material"
import { Spinner } from "@wordpress/components"
import React, { useContext, useEffect, useState } from "react"
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
const StyledForm = styled.form`
  display: grid;
  grid-template-columns: 0.5fr 1.2fr 0.1fr;
  gap: 10px;
  margin-top: 12px;
  @media (max-width: 767.98px) {
    grid-template-columns: 1fr;
    gap: 0px;
  }
`
const StyledBtn = styled.button`
  width: 50px;
  height: 49px;
  background: #dae3eb;
  border: none;
  outline: none;
  display: flex;
  justify-content: center;
  align-items: center;
  justify-self: end;
  svg {
    transform: rotate(45deg);
    width: 20px;
    .bg {
      fill: #08457a;
    }
  }
  @media (max-width: 767.98px) {
    width: 100%;
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
  const [peerReviews, setPeerReviews] = useState(false)
  const [peerReviewState, peerReviewSetState] = useState<CmsPeerReview[]>([])
  const [peerReviewQuestionState, peerReviewQuestionSetState] = useState<CmsPeerReviewQuestion[]>(
    [],
  )

  const courseId = useContext(PageContext)?.page.course_id

  const { t } = useTranslation()

  const peerReviewQuestionTypeoptions = [
    { label: t("select-question"), value: "", disabled: true },
    { label: t("essay"), value: t("essay") },
    { label: t("linkert-scale"), value: t("linkert-scale") },
  ]

  const peerReviewAcceptingStrategyOptions = [
    { label: "Select accepting strategy", value: "", disabled: true },
    {
      label: "Automatically accept or reject by average",
      value: "automatically_accept_or_reject_by_average",
    },
    {
      label: "Automatically accept or manual review by average",
      value: "automatically_accept_or_manual_review_by_average",
    },
    {
      label: "Manual review everything",
      value: "manual_review_everything",
    },
  ]

  const handlePeerReviewQuestionChange = (e: any) => {
    const id = e.parentElement.id
    const value = e.innerText
    peerReviewQuestionSetState((prevState) => {
      return prevState.map((item) => {
        return item.id === id
          ? {
              ...item,
              question: value,
            }
          : item
      })
    })
  }

  useEffect(
    () =>
      setAttributes({
        ...attributes,
        peer_review_questions_config: JSON.stringify(peerReviewQuestionState),
      }),
    [peerReviewQuestionState],
  )

  useEffect(
    () => setAttributes({ ...attributes, peer_review_config: JSON.stringify(peerReviewState) }),
    [peerReviewState],
  )
  if (!courseId) {
    return <Spinner />
  }
  return (
    <>
      <Switch
        value={peerReviews}
        onClick={() => {
          setPeerReviews(!peerReviews)
          setAttributes({
            ...attributes,
            peer_review_questions_config: "",
            peer_review_config: "",
          })
        }}
      ></Switch>
      {peerReviews && (
        <div>
          <Button
            variant="primary"
            size="medium"
            onClick={() =>
              peerReviewSetState([
                ...peerReviewState,
                {
                  id: v4(),
                  course_id: courseId,
                  exercise_id: exerciseId,
                  peer_reviews_to_give: 0,
                  peer_reviews_to_receive: 0,
                  accepting_strategy: "AutomaticallyAcceptOrManualReviewByAverage",
                  accepting_threshold: 0,
                },
              ])
            }
          >
            {t("add-peer-review")}
          </Button>
          {peerReviewState.map((pr) => {
            return (
              <div key={pr.id} id={pr.id}>
                <Button
                  variant="secondary"
                  size="medium"
                  onClick={() => {
                    peerReviewSetState((prevState) => {
                      return prevState.filter((x) => pr.id !== x.id)
                    })
                  }}
                >
                  {t("delete")}
                </Button>
                <Wrapper>
                  <span>{t("peer-review-instructions")}</span>
                  <TextField name={INSTRUCTION} placeholder={PLACEHOLDER} onChange={() => null} />
                  <span>{t("peer-reviews-to-receive")}</span>
                  <input
                    type={"number"}
                    value={pr.peer_reviews_to_receive}
                    onChange={(e) => {
                      const peerReview = peerReviewState.filter((prx) => prx.id === pr.id)[0]
                      peerReviewSetState([
                        { ...peerReview, peer_reviews_to_receive: Number(e.target.value) },
                        ...peerReviewState.filter((prx) => prx.id !== pr.id),
                      ])
                    }}
                  />

                  <span>{t("peer-reviews-to-give")}</span>
                  <input
                    type={"number"}
                    value={pr.peer_reviews_to_give}
                    onChange={(e) => {
                      const peerReview = peerReviewState.filter((prx) => prx.id === pr.id)[0]
                      peerReviewSetState([
                        { ...peerReview, peer_reviews_to_give: Number(e.target.value) },
                        ...peerReviewState.filter((prx) => prx.id !== pr.id),
                      ])
                    }}
                  />
                  <span>{t("peer-review-accepting-strategy")}</span>
                  <SelectField
                    id={`peer-review-accepting-strategy-${id}`}
                    onBlur={() => null}
                    onChange={(e) => {
                      const peerReview = peerReviewState.filter((prx) => prx.id === pr.id)[0]
                      let strategy: PeerReviewAcceptingStrategy =
                        "AutomaticallyAcceptOrManualReviewByAverage"

                      if (e === "AutomaticallyAcceptOrRejectByAverage") {
                        strategy = "AutomaticallyAcceptOrRejectByAverage"
                      } else if (e === "AutomaticallyAcceptOrManualReviewByAverage") {
                        strategy = "AutomaticallyAcceptOrManualReviewByAverage"
                      } else if (e === "ManualReviewEverything") {
                        strategy = "ManualReviewEverything"
                      }
                      peerReviewSetState([
                        { ...peerReview, accepting_strategy: strategy },
                        ...peerReviewState.filter((prx) => prx.id !== pr.id),
                      ])
                    }}
                    options={peerReviewAcceptingStrategyOptions}
                  />
                  <span>{t("peer-review-accepting-threshold")}</span>
                  <input
                    type={"number"}
                    step="0.01"
                    onChange={(e) => {
                      const peerReview = peerReviewState.filter((prx) => prx.id === pr.id)[0]
                      peerReviewSetState([
                        { ...peerReview, accepting_threshold: Number(e.target.value) },
                        ...peerReviewState.filter((prx) => prx.id !== pr.id),
                      ])
                    }}
                  />

                  <h2>{HEADING_TEXT}</h2>
                  {peerReviewQuestionState &&
                    peerReviewQuestionState.map(({ id, question, question_type }) => (
                      <List key={id} id={id}>
                        <StyledQuestion>
                          <TextAreaField
                            onChange={handlePeerReviewQuestionChange}
                            defaultValue={question_type}
                            autoResize={true}
                          />
                        </StyledQuestion>
                        <StyledQuestionType>
                          <TextAreaField
                            onChange={handlePeerReviewQuestionChange}
                            defaultValue={question}
                            autoResize={true}
                          />
                        </StyledQuestionType>
                        <DeleteBtn
                          aria-label={t("delete")}
                          onClick={() => {
                            peerReviewQuestionSetState((prevState) => {
                              return prevState.filter((o) => {
                                return question !== o.question
                              })
                            })
                          }}
                        >
                          <FontAwesomeIcon icon={faXmark} />
                        </DeleteBtn>
                      </List>
                    ))}
                  <StyledForm
                    onSubmit={(e: React.SyntheticEvent) => {
                      e.preventDefault()
                      const target = e.target as typeof e.target & {
                        question: { value: string }
                        questionType: { value: string }
                      }

                      const question = target.question.value
                      const type = target.questionType.value

                      if (question !== "" && type !== "") {
                        const questionType: PeerReviewQuestionType =
                          type === "Essay" ? "Essay" : "Scale"
                        peerReviewQuestionSetState([
                          ...peerReviewQuestionState,
                          {
                            id: v4(),
                            question,
                            question_type: questionType,
                            peer_review_id: pr.id,
                            answer_required: true,
                            order_number: 0,
                          },
                        ])
                      }
                      target.question.value = ""
                      target.questionType.value = ""
                    }}
                  >
                    <StyledSelectField
                      id={`question-type-${id}`}
                      name={TYPE}
                      placeholder={PLACEHOLDER}
                      options={peerReviewQuestionTypeoptions}
                      onChange={() => null}
                      onBlur={() => null}
                    />
                    <TextField
                      name={QUESTION}
                      placeholder={QUESTION_PLACEHOLDER}
                      onChange={() => null}
                    />
                    <StyledBtn
                      aria-label={t("submit")}
                      type="submit"
                      name={t("submit")}
                      value={t("submit")}
                    >
                      <FontAwesomeIcon icon={faXmark} />
                    </StyledBtn>
                  </StyledForm>
                </Wrapper>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}

export default PeerReviewEditor
