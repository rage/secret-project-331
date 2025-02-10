import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import Agree from "../../img/likert/agree.svg"
import Disagree from "../../img/likert/disagree.svg"
import Neutral from "../../img/likert/neutral.svg"
import StronglyAgree from "../../img/likert/stronglyAgree.svg"
import StronglyDisagree from "../../img/likert/stronglyDisagree.svg"

const Wrapper = styled.div`
  margin: 1.5rem auto;
  max-width: 1000px;
`
const Question = styled.span`
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
  justify-items: center;
`

const Likert = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15px 0;
  background-color: ${({ active }: StyledProps) => (active ? "#313947" : "#f9f9f9")};
  cursor: pointer;
  transition: all 0.2s;

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

interface LikertScaleProps {
  disabled?: boolean
  question: string
  answerRequired: boolean
  selectedOption: number | null
  setSelectedOption: (value: number | null) => void
}

interface StyledProps {
  active: boolean
}

const LikertScale: React.FC<React.PropsWithChildren<React.PropsWithChildren<LikertScaleProps>>> = ({
  disabled,
  question,
  answerRequired,
  selectedOption,
  setSelectedOption,
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
      <Question>
        {question}
        {answerRequired && " *"}
      </Question>

      <Likerts>
        {arr.map((option, n) => (
          <Likert
            key={n + 1}
            onClick={() => {
              if (!disabled) {
                setSelectedOption(n + 1)
              }
            }}
            active={selectedOption === n + 1}
          >
            {option.image}
            <p className="likert-scale-text">{option.text}</p>
          </Likert>
        ))}
      </Likerts>
    </Wrapper>
  )
}
LikertScale.defaultProps = { disabled: false }

export default LikertScale
