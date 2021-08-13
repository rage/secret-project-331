import { ThemeProvider } from "@emotion/react"
import styled from "@emotion/styled"
import React from "react"

import { theme, typography } from "../utils"

/* import { border, color, space } from "styled-system" */

const HeroWrapper = styled.div`
  height: 584px;
  background: #f1f1f1;
  width: 100%;
  border-radius: 1px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
`

const TextBox = styled.div`
  display: flex;
  flex-direction: column;
  padding: 2rem 2.5rem;
  height: 100%;
  margin-bottom: 1rem;
  align-items: center;
  text-align: center;
  justify-content: center;

  h1 {
    font-size: 50px;
    font-size: ${typography.h2};
    font-weight: 400;
    z-index: 20;
    margin-bottom: 0.8rem;
    margin-top: 1.5rem;
    line-height: 110px;
  }

  span {
    font-style: normal;
    font-weight: 600;
    font-size: 22px;
    line-height: 40px;
    /* or 182% */

    text-align: center;

    color: #000000;

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
    <ThemeProvider theme={theme}>
      <>
        <HeroWrapper>
          <TextBox>
            <h2>{title}</h2>
            {children}
          </TextBox>
        </HeroWrapper>
      </>
    </ThemeProvider>
  )
}

export default CourseObjectiveSection
