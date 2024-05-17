import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { headingFont } from "../../../../../../shared-module/common/styles"

import { Agree, NeitherAgreeNorDisagree, StronglyDisagree } from "./LikertSvgs"

interface LikertProps {
  question: string
  index: number
  content: number | null
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
  gap: 20px;
  margin: 10px auto 0 auto;
  max-width: 1000px;
`

/* eslint-disable i18next/no-literal-string */
const Icon = styled.div<StyledProps>`
  width: 130px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 25px 0;
  background-color: ${({ active }: StyledProps) => (active ? "#313947" : " #f5f6f7")};
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s;
  text-align: center;

  svg .bg {
    fill: ${({ active }) => active && "#ffd93b"};
  }

  .likert-scale-text {
    margin-top: 6px;
    font-size: 15px;
    font-weight: 600;
    color: ${({ active }) => (active ? "#ffffff" : "#313947")};
    font-family: ${headingFont};
    height: 25px;
  }
`

const Likert: React.FC<LikertProps> = ({ question, content, index }) => {
  const { t } = useTranslation()
  const arr: { text: string; svg: () => React.JSX.Element }[] = [
    {
      text: t("likert-scale-strongly-disagree"),
      svg: StronglyDisagree,
    },
    {
      text: t("likert-scale-disagree"),
      svg: Agree,
    },
    {
      text: t("likert-scale-neither-agree-nor-disagree"),
      svg: NeitherAgreeNorDisagree,
    },
    {
      text: t("likert-scale-agree"),
      svg: Agree,
    },
    {
      text: t("likert-scale-strongly-agree"),
      svg: StronglyDisagree,
    },
  ]

  return (
    <Wrapper>
      <Question>{`${t("question")} ${index + 1}: ${question}`}</Question>
      <IconContainer>
        {arr.map((option, n) => (
          <Icon key={n} active={content === n + 1}>
            {<option.svg />}
            <p className="likert-scale-text">{option.text}</p>
          </Icon>
        ))}
      </IconContainer>
    </Wrapper>
  )
}

export default Likert
