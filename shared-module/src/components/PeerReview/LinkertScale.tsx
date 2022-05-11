import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Agree from "../../img/linkert/agree.svg"
import Disagree from "../../img/linkert/disagree.svg"
import Neutral from "../../img/linkert/neutral.svg"
import StronglyAgree from "../../img/linkert/stronglyAgree.svg"
import StronglyDisagree from "../../img/linkert/stronglyDisagree.svg"

const Wrapper = styled.div`
  margin: 0 auto;
  max-width: 1000px;
`
const Question = styled.span`
  /* text-align: center; */
  font-size: 22px;
  margin: 0 auto;
  display: block;
  color: #1a2333;
  padding: 20px 0;
`
const Linkerts = styled.div`
  background: #f9f9f9;
  min-height: 100px;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
`

/* eslint-disable i18next/no-literal-string */
const Linkert = styled.div`
  width: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: 25px 0;
  background-color: ${({ active }: StyledProps) => (active ? "#313947" : "#f9f9f9")};

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
    font-size: 17px;
    font-weight: 500;
    color: ${({ active }) => (active ? "#ffffff" : "#313947")};
    text-transform: capitalize;
  }
`
/* export interface LinkertScaleExtraProps {} */

const PLACEHOLDER = "Answer is thoughtful and rich?"

export type LinkertScaleComponentProps = React.HTMLAttributes<HTMLDivElement> /* &
  LinkertScaleExtraProps */

interface StyledProps {
  active: boolean
}

const LinkertScale: React.FC<LinkertScaleComponentProps> = () => {
  const [active, setActive] = useState<string>("")
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
      <Question>{PLACEHOLDER}</Question>
      <Linkerts>
        {arr.map(({ text }) => (
          <Linkert key={text} onClick={() => setActive(text)} active={active === text}>
            {SVGmatcher(text)}
            <p className="linkert-scale-text">{text}</p>
          </Linkert>
        ))}
      </Linkerts>
    </Wrapper>
  )
}

export default LinkertScale
