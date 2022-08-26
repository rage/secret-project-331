import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import Circle from "../../img/card-bg-circle.svg"
import Star from "../../img/card-bg-star.svg"
import Zigzag from "../../img/card-bg-zigzag.svg"
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

const SVG = [Star, Circle, Zigzag, Zigzag, Star, Circle]

const TextBox = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  margin-bottom: 1rem;
  align-items: center;
  text-align: center;
  gap: 1rem;
  justify-content: center;

  ${respondToOrLarger.md} {
    padding: 0rem 0rem;
    grid-template-columns: repeat(2, 1fr);
  }

  ${respondToOrLarger.lg} {
    padding: 0rem 0rem;
    grid-template-columns: repeat(3, 1fr);
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
  min-height: 100%;
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
    top: -45px;
    left: -100px;
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
  const data = children && Object.values(children)[0].props.data.innerBlocks
  return (
    <Wrapper>
      <h2>{title}</h2>
      <TextBox>
        {data &&
          data.map((item: { innerBlocks: any; clientId: string | null }, index: number) => {
            const BackgroundSVG = SVG[index]
            const innerBlocks = item.innerBlocks

            return (
              <Objective key={item.clientId}>
                <BackgroundSVG />
                {innerBlocks && innerBlocks[0].name === "core/heading" && (
                  <h2
                    className={css`
                      font-size: 20px !important;
                      margin: 2rem 2rem 0 2rem;
                    `}
                  >
                    {innerBlocks[0].attributes.content}
                  </h2>
                )}
                <span>
                  {innerBlocks && innerBlocks.length > 1
                    ? innerBlocks[1].attributes.content
                    : innerBlocks[0].attributes.content}
                </span>
              </Objective>
            )
          })}
      </TextBox>
    </Wrapper>
  )
}

export default CourseObjective
