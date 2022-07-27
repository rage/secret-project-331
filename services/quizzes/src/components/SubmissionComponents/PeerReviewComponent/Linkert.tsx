import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import Agree from "../../../shared-module/img/linkert/agree.svg"
import Disagree from "../../../shared-module/img/linkert/disagree.svg"
import Neutral from "../../../shared-module/img/linkert/neutral.svg"
import StronglyAgree from "../../../shared-module/img/linkert/stronglyAgree.svg"
import StronglyDisagree from "../../../shared-module/img/linkert/stronglyDisagree.svg"
import { headingFont } from "../../../shared-module/styles"

interface LinkertProps {
  question: string
  index: number
  content: string | number
}

interface StyledProps {
  active: boolean
}

const Wrapper = styled.div`
  margin: 0 auto;
  padding: 1rem;
`
const Question = styled.span`
  font-size: 17px;
  color: #215887;
  line-height: 1.4;
  margin-bottom: 0.8rem;
`
const IconContainer = styled.div`
  min-height: 100px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
  margin: 0 auto;
  max-width: 1000px;
`

/* eslint-disable i18next/no-literal-string */
const Icon = styled.div<StyledProps>`
  width: 150px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 25px 0;
  background-color: ${({ active }: StyledProps) => (active ? "#313947" : " #f5f6f7")};
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;

  svg .bg {
    fill: ${({ active }) => active && "#ffd93b"};
  }

  .linkert-scale-text {
    margin-top: 6px;
    font-size: 15px;
    font-weight: 600;
    color: ${({ active }) => (active ? "#ffffff" : "#313947")};
    font-family: ${headingFont};
  }
`

const Linkert: React.FC<LinkertProps> = ({ question, content, index }) => {
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
      <Question>{`Question ${index + 1}: ${question}`}</Question>
      <IconContainer>
        {arr.map((option, n) => (
          <Icon key={n} active={content === n}>
            {/* {SVGmatcher(option.text)} */}
            <p className="linkert-scale-text">{option.text}</p>
          </Icon>
        ))}
      </IconContainer>
    </Wrapper>
  )
}

export default Linkert
