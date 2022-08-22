import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { primaryFont } from "../../styles/typography"
import TextArea from "../InputFields/TextAreaField"

import LikertScale from "./LikertScale"

const Wrapper = styled.div`
  margin: 0 auto;
  max-width: 1000px;

  .comment {
    display: inline-block;
    font-size: 20px;
    margin-bottom: 10px;
    color: #1a2333;
  }
`
const StyledInstruction = styled.div`
  margin-bottom: 3rem;

  .instruction {
    font-family: ${primaryFont};
    margin-bottom: 5px;
  }

  .instruction-text {
    font-size: 18px;
    line-height: 24px;
    color: #313947;
  }
`
const INSTRUCTION_TEXT = `Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has
been the industrys standard dummy text ever since the 1500s, when an unknown printer took
a galley of type and scrambled.`

const GENERAL_COMMENTS = "General comments"

const EXAMPLE_QUESTION = "Example question"

export type ReviewComponentProps = React.HTMLAttributes<HTMLDivElement>

const Review: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<ReviewComponentProps>>
> = () => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      <StyledInstruction>
        <h3 className="instruction">{t("instruction")}</h3>
        <p className="instruction-text">{INSTRUCTION_TEXT}</p>
      </StyledInstruction>

      <span className="comment">{GENERAL_COMMENTS}</span>
      <TextArea placeholder={t("write-a-review")} onChange={() => null}></TextArea>
      <LikertScale
        question={EXAMPLE_QUESTION}
        answerRequired={false}
        selectedOption={null}
        setSelectedOption={function (_value: number | null): void {
          // NOP
        }}
      />
    </Wrapper>
  )
}

export default Review
