import styled from "@emotion/styled"
import { faXmark } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { v4 } from "uuid"

import { CmsPeerReviewQuestion } from "../../../../shared-module/src/bindings"
import TextAreaField from "../../../../shared-module/src/components/InputFields/EditableComponentTextArea"
import SelectField from "../../../../shared-module/src/components/InputFields/SelectField"
import TextField from "../../../../shared-module/src/components/InputFields/TextField"
import { PeerReviewQuestionType } from "../shared-module/bindings"

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
}

export type PeerReviewEditorProps = React.HTMLAttributes<HTMLDivElement> &
  PeerReviewEditorExtraProps

const PeerReviewEditor: React.FC<PeerReviewEditorProps> = ({ id, attributes, setAttributes }) => {
  const [state, setState] = useState<CmsPeerReviewQuestion[]>([])
  const { t } = useTranslation()

  const options = [
    { label: t("select-question"), value: "", disabled: true },
    { label: t("essay"), value: t("essay") },
    { label: t("linkert-scale"), value: t("linkert-scale") },
  ]

  const handleChange = (e: any) => {
    const id = e.parentElement.id
    const value = e.innerText
    setState((prevState) => {
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
    () => setAttributes({ ...attributes, peer_review_config: JSON.stringify(state) }),
    [state, attributes, setAttributes],
  )

  return (
    <Wrapper>
      <span>{t("peer-review-instructions")}</span>
      <TextField name={INSTRUCTION} placeholder={PLACEHOLDER} onChange={() => null} />

      <h2>{HEADING_TEXT}</h2>
      {state &&
        state.map(({ id, question, question_type }) => (
          <List key={id} id={id}>
            <StyledQuestion>
              <TextAreaField
                onChange={handleChange}
                defaultValue={question_type}
                autoResize={true}
              />
            </StyledQuestion>
            <StyledQuestionType>
              <TextAreaField onChange={handleChange} defaultValue={question} autoResize={true} />
            </StyledQuestionType>
            <DeleteBtn
              aria-label={t("delete")}
              onClick={() => {
                setState((prevState) => {
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

          // eslint-disable-next-line i18next/no-literal-string
          const questionType: PeerReviewQuestionType = type === "Essay" ? "Essay" : "Scale"

          if (question !== "" && type !== "") {
            setState([
              ...state,
              {
                // eslint-disable-next-line i18next/no-literal-string
                id: v4(),
                question,
                question_type: questionType,
                peer_review_id: v4(),
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
          options={options}
          onChange={() => null}
          onBlur={() => null}
        />
        <TextField name={QUESTION} placeholder={QUESTION_PLACEHOLDER} onChange={() => null} />
        <StyledBtn aria-label={t("submit")} type="submit" name={t("submit")} value={t("submit")}>
          <FontAwesomeIcon icon={faXmark} />
        </StyledBtn>
      </StyledForm>
    </Wrapper>
  )
}

export default PeerReviewEditor
