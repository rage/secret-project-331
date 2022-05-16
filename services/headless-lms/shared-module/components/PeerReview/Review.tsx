import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { primaryFont } from "../../styles/typography"
import TextArea from "../InputFields/TextAreaField"

import LinkertScale from "./LinkertScale"

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

export type ReviewComponentProps = React.HTMLAttributes<HTMLDivElement>

const Review: React.FC<ReviewComponentProps> = () => {
  const { t } = useTranslation()
  return (
    <Wrapper>
      <StyledInstruction>
        <h3 className="instruction">{t("instruction")}</h3>
        <p className="instruction-text">{INSTRUCTION_TEXT}</p>
      </StyledInstruction>

      <span className="comment">{t("general-comment")}</span>
      <TextArea placeholder={t("write-a-review")} onChange={() => null}></TextArea>
      <LinkertScale />
    </Wrapper>
  )
}

export default Review
