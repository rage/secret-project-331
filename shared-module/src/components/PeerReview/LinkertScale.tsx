import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import Agree from "../../img/linkert/agree.svg"
import Disagree from "../../img/linkert/disagree.svg"
import Neutral from "../../img/linkert/neutral.svg"
import StronglyAgree from "../../img/linkert/stronglyAgree.svg"
import StronglyDisagree from "../../img/linkert/stronglyDisagree.svg"

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
const Linkerts = styled.div`
  background: #f9f9f9;
  min-height: 100px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  margin: 0 auto;
  max-width: 1000px;
`

/* eslint-disable i18next/no-literal-string */
const Linkert = styled.div`
  width: 150px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 25px 0;
  background-color: ${({ active }: StyledProps) => (active ? "#313947" : "#f9f9f9")};
  cursor: pointer;
  transition: all 0.2s;

  svg .bg {
    fill: ${({ active }) => active && "#ffd93b"};
  }

  &:hover {
    background: ${({ active }: StyledProps) => (active ? "#313947" : "#babdc2")};
    svg .bg {
      fill: #ffd93b;
    }
  }

  .linkert-scale-text {
    margin-top: 6px;
    font-size: 15px;
    font-weight: 500;
    color: ${({ active }) => (active ? "#ffffff" : "#313947")};
    text-transform: capitalize;
  }
`

interface LikertScaleProps {
  question: string
  answerRequired: boolean
  selectedOption: number | null
  setSelectedOption: (value: number | null) => void
}

interface StyledProps {
  active: boolean
}

const LinkertScale: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<LikertScaleProps>>
> = ({ question, answerRequired, selectedOption, setSelectedOption }) => {
  const { t } = useTranslation()

  const arr = [
    {
      text: t("strongly-disagree"),
    },
    {
      text: t("disagree"),
    },
    {
      text: t("neutral"),
    },
    {
      text: t("agree"),
    },
    {
      text: t("strongly-agree"),
    },
  ]

  const SVGmatcher = (identifier: string) => {
    switch (identifier) {
      case "agree":
        return <Agree />
        break
      case "strongly agree":
        return <StronglyAgree />
        break
      case "neutral":
        return <Neutral />
        break
      case "disagree":
        return <Disagree />
        break
      case "strongly disagree":
        return <StronglyDisagree />
      default:
    }
  }

  return (
    <Wrapper>
      <Question>
        {question}
        {answerRequired && " *"}
      </Question>

      <Linkerts>
        {arr.map((option, n) => (
          <Linkert
            key={n}
            onClick={() => {
              setSelectedOption(n)
            }}
            active={selectedOption === n}
          >
            {SVGmatcher(option.text)}
            <p className="linkert-scale-text">{option.text}</p>
          </Linkert>
        ))}
      </Linkerts>
    </Wrapper>
  )
}

export default LinkertScale
