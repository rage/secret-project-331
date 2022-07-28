import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { headingFont } from "../../../shared-module/styles"

import SVGMatcher from "./SVGmatcher"

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
  font-size: 16px;
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
  border-radius: 2px;
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

  return (
    <Wrapper>
      <Question>{`Question ${index + 1}: ${question}`}</Question>
      <IconContainer>
        {arr.map((option, n) => (
          <Icon key={n} active={content === n}>
            {SVGMatcher(option.text)}
            <p className="linkert-scale-text">{option.text}</p>
          </Icon>
        ))}
      </IconContainer>
    </Wrapper>
  )
}

export default Linkert
