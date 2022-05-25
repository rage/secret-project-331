import styled from "@emotion/styled"
import React from "react"
import { headingFont, primaryFont } from "../styles"


const Wrapper = styled.div`
background: #F5F6F7;
max-width: 1088px;
height: auto;
padding: 20px 20px 50px 40px;

@media (max-width: 767.98px) {
  padding: 15px 0 30px 0;
}

h4 {
  font-family: ${primaryFont} !important;
  font-weight: 400;
  color: #535A66;

  @media (max-width: 767.98px) {
    padding-left: 15px;
  }
}
`
const List = styled.div`
display: grid;
grid-template-columns: repeat(3, 1fr);
height: 100%;
margin-top: 2rem;

.student-attempts {
  border-right: 2px solid #BABDC2;
    span {
      color: #44827E;
    }
  }
.required-attempts {
  border-right: 2px solid #BABDC2;
    span {
      color: #215887;
    }
  }
`
const Item = styled.div`
display: grid;
align-item: center;
height: 100%;
justify-content: center;
  span:first-of-type {
    display: block;
    font-family: ${headingFont};
    font-size: clamp(50px, 5vw, 5rem);
    line-height: 1;
    text-align: center;
  }

  div {
    font-size: 20px;
    font-weight: 300;
    text-align: center;
    line-height: 20px;
    color: #535A66;

    @media (max-width: 767.98px) {
      font-size: 16px;
    }
  }
`

export interface AttemptTrackerExtraProps {
  studentAttempts: number
  requiredAttempts: number
  totalExercise: number

}

const TITLE_PLACEHOLDER = "So far attempts in this chapter..."
const STUDENT_ATTEMPTS = "Exercises attempted"
const REQUIRED_ATTEMPTS = "Exercise required"
const TOTAL_EXERCISE = "Total Exercise"

export type AttemptTrackerProps = React.HTMLAttributes<HTMLDivElement> & AttemptTrackerExtraProps

const AttemptTracker: React.FC<AttemptTrackerProps> = ({ studentAttempts = 2, requiredAttempts = 14, totalExercise = 14}) => {
  return (
    <Wrapper>
      <h4>{TITLE_PLACEHOLDER}</h4>
      <List>
        <Item className="student-attempts">
          <span>{studentAttempts}</span>
          <div>{STUDENT_ATTEMPTS}</div>
        </Item>
        <Item className="required-attempts">
          <span>{requiredAttempts}</span>
          <div>{REQUIRED_ATTEMPTS}</div>
        </Item>
        <Item className="total-exercise">
          <span>{totalExercise}</span>
          <div>{TOTAL_EXERCISE}</div>
        </Item>

      </List>
    </Wrapper>
  )
}

export default AttemptTracker
