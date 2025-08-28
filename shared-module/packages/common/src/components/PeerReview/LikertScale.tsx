import styled from "@emotion/styled"
import React from "react"
import { ToggleButton, ToggleButtonGroup } from "react-aria-components"
import { useTranslation } from "react-i18next"

import Agree from "../../img/likert/agree.svg"
import Disagree from "../../img/likert/disagree.svg"
import Neutral from "../../img/likert/neutral.svg"
import StronglyAgree from "../../img/likert/stronglyAgree.svg"
import StronglyDisagree from "../../img/likert/stronglyDisagree.svg"
import { baseTheme } from "../../styles"

const Wrapper = styled.div`
  margin: 1.5rem auto;
  max-width: 1000px;
`
const Question = styled.legend`
  font-size: 22px;
  margin: 0 auto;
  margin-bottom: 1rem;
  display: block;
  color: #1a2333;
`
const Likerts = styled.div`
  background: #f9f9f9;
  min-height: 100px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  margin: 0 auto;
  max-width: 1000px;
`

const StyledToggleButton = styled(ToggleButton)<StyledProps>`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15px 0;
  background-color: ${({ active }: StyledProps) => (active ? "#313947" : "#f9f9f9")};
  cursor: pointer;
  transition: all 0.2s;
  border: 0;
  outline-offset: -4px;

  svg .bg {
    fill: ${({ active }) => active && "#ffd93b"};
  }

  svg {
    margin-top: 10px;
    margin-bottom: 5px;
  }

  &:hover {
    background: ${({ active }: StyledProps) => (active ? "#313947" : "#babdc2")};
    svg .bg {
      fill: #ffd93b;
    }
  }

  &:focus {
    outline: 3px solid
      ${({ active }) => (active ? baseTheme.colors.green[200] : baseTheme.colors.green[400])};
  }

  .likert-scale-text {
    margin-top: 6px;
    font-size: 15px;
    font-weight: 500;
    color: ${({ active }) => (active ? "#ffffff" : "#313947")};
    text-align: center;
    line-height: 1.2;
    padding: 0 0.5rem;
  }
`

const StyledFieldset = styled.fieldset`
  border: 0;
  margin: 0;
  padding: 0;
  min-width: 0;
`

interface LikertScaleProps {
  disabled?: boolean
  question: string
  answerRequired: boolean
  selectedOption: number | null
  setSelectedOption: (value: number | null) => void
  peerOrSelfReviewQuestionId: string
}

interface StyledProps {
  active: boolean
}

const LikertScale: React.FC<React.PropsWithChildren<LikertScaleProps>> = ({
  disabled,
  question,
  answerRequired,
  selectedOption,
  setSelectedOption,
  peerOrSelfReviewQuestionId,
}) => {
  const { t } = useTranslation()

  const arr = [
    {
      text: t("likert-scale-strongly-disagree"),
      image: <StronglyDisagree />,
    },
    {
      text: t("likert-scale-disagree"),
      image: <Disagree />,
    },
    {
      text: t("likert-scale-neither-agree-nor-disagree"),
      image: <Neutral />,
    },
    {
      text: t("likert-scale-agree"),
      image: <Agree />,
    },
    {
      text: t("likert-scale-strongly-agree"),
      image: <StronglyAgree />,
    },
  ]

  return (
    <Wrapper>
      <StyledFieldset>
        <Question>
          {question} {answerRequired && " *"}
        </Question>
        <ToggleButtonGroup aria-required={answerRequired}>
          <Likerts>
            {arr.map((option, n) => (
              <StyledToggleButton
                active={selectedOption === n + 1}
                id={`likert-scale-${peerOrSelfReviewQuestionId}-option-${n + 1}`}
                key={n + 1}
                onClick={() => {
                  if (!disabled) {
                    setSelectedOption(n + 1)
                  }
                }}
              >
                {option.image}
                <p className="likert-scale-text">{option.text}</p>
              </StyledToggleButton>
            ))}
          </Likerts>
        </ToggleButtonGroup>
      </StyledFieldset>
    </Wrapper>
  )
}

export default LikertScale
