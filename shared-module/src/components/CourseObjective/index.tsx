import styled from "@emotion/styled"
import React from "react"

import Circle from "../../img/card-bg-circle.svg"
import Star from "../../img/card-bg-star.svg"
import Zigzag from "../../img/card-bg-zigzag.svg"
import { baseTheme } from "../../styles"
import { respondToOrLarger } from "../../styles/respond"

// eslint-disable-next-line i18next/no-literal-string
const Wrapper = styled.div`
  width: 100%;
  border-radius: 1px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  padding: 3rem;

  h2 {
    z-index: 20;
    font-size: 3.5rem;
    font-size: clamp(30px, 3vw, 3rem);
    font-style: normal;
    font-weight: 600;
    text-align: left;
    padding-bottom: 1em;
    line-height: 1.1;
  }
`

const arr = [
  // eslint-disable-next-line i18next/no-literal-string
  "...a basic understanding of various ethical and social aspects of AI at the levels of social interaction and the society as a whole.",
  // eslint-disable-next-line i18next/no-literal-string
  "...a necessary conceptual framework and cognitive tools to situate AI applications in their social contexts and to assess their societal impact",
  // eslint-disable-next-line i18next/no-literal-string
  "...the ability to think about and to prevent potentially unwanted consequences and make deliberate choices in value-laden contexts while developing, deploying or using AI applications",
]

const SVG = [Star, Circle, Zigzag]

const TextBox = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin-bottom: 1rem;
  align-items: center;
  text-align: center;
  gap: 1rem;
  justify-content: center;

  ${respondToOrLarger.xs} {
    padding: 0rem 0rem;
  }

  ${respondToOrLarger.sm} {
    padding: 0rem 0rem;
  }

  ${respondToOrLarger.md} {
    padding: 0rem 0rem;
  ${respondToOrLarger.lg} {
    padding: 0rem 0rem;
  }

  h3 {
    text-align: left;
    padding-right: 0;

    ${respondToOrLarger.md} {
      padding-right: 40px;
    }
  }
`
const Objective = styled.div`
  width: 100%;
  height: 280px;
  background: #f5f6f7;
  position: relative;
  overflow: hidden;
  display: grid;

  span {
    margin: auto 2rem 2rem 2rem;
    text-align: left;
    padding-right: 0;
    z-index: 99;

    /*     ${respondToOrLarger.md} {
      padding-right: 40px;
    } */
  }

  svg {
    position: absolute;
    top: -80px;
    left: -80px;
    transform: rotate(180deg);
  }
`

export interface CourseObjectiveSectionProps {
  title: string
}

export type CardProps = React.HTMLAttributes<HTMLDivElement> & CourseObjectiveSectionProps

const CourseObjective: React.FC<React.PropsWithChildren<React.PropsWithChildren<CardProps>>> = ({
  title,
  children,
}) => {
  return (
    <Wrapper>
      <h2>{title}</h2>
      <TextBox>
        {arr.map((item, index) => {
          const BackgroundSVG = SVG[index]
          return (
            <>
              <Objective key={index}>
                <BackgroundSVG />
                <span>{item}</span>
              </Objective>
            </>
          )
        })}
      </TextBox>
    </Wrapper>
  )
}

export default CourseObjective
