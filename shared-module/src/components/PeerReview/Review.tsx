/* eslint-disable i18next/no-literal-string */
import styled from "@emotion/styled"
import React from "react"

import { primaryFont } from "../../styles/typography"
import TextArea from "../InputFields/TextAreaField"

import LinkertScale from "./LinkertScale"
import PeerReviewProgress from "./PeerReviewProgress"

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
  margin-bottom: 20px;

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
/* export interface ReviewExtraProps {} */

export type ReviewComponentProps = React.HTMLAttributes<HTMLDivElement> /* & ReviewExtraProps */

const Review: React.FC<ReviewComponentProps> = () => {
  return (
    <Wrapper>
      <StyledInstruction>
        <h3 className="instruction">Instruction</h3>
        <p className="instruction-text">
          Lorem Ipsum is simply dummy text of the printing and typesetting industry. Lorem Ipsum has
          been the industrys standard dummy text ever since the 1500s, when an unknown printer took
          a galley of type and scrambled.
        </p>
      </StyledInstruction>

      <span className="comment">General comment</span>
      <TextArea placeholder="Write a review" onChange={() => null}></TextArea>
      <LinkertScale />
      <PeerReviewProgress total={10} attempt={2} />
    </Wrapper>
  )
}

export default Review
