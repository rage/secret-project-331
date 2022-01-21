import styled from "@emotion/styled"
import React from "react"

import { baseTheme } from "../styles"

const HeroWrapper = styled.div`
  background: #f1f1f1;
  width: 100%;
  border-radius: 1px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  padding: 7.5em 1em;
`

const TextBox = styled.div`
  display: flex;
  flex-direction: column;
  padding: 2rem 2.5rem;
  margin-bottom: 1rem;
  align-items: center;
  text-align: center;
  justify-content: center;

  h2 {
    font-weight: 400;
    z-index: 20;
    margin-bottom: 2em;
  }

  span {
    font-style: normal;
    font-weight: 600;
    font-size: 22px;
    line-height: 40px;
    /* or 182% */

    text-align: center;

    color: ${baseTheme.colors.clear[200]};

    opacity: 0.7;
  }
`
export interface CourseObjectiveSectionProps {
  title: string
  bg?: string
}

export type CardProps = React.HTMLAttributes<HTMLDivElement> & CourseObjectiveSectionProps

const CourseObjectiveSection: React.FC<CardProps> = ({ title, children }) => {
  return (
    <>
      <>
        <HeroWrapper>
          <TextBox>
            <h2>{title}</h2>
            {children}
          </TextBox>
        </HeroWrapper>
      </>
    </>
  )
}

export default CourseObjectiveSection
