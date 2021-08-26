import { css, cx } from "@emotion/css"
import { ThemeProvider } from "@emotion/react"
import styled from "@emotion/styled"
import React from "react"

import CardSVG from "../../img/cardNext.svg"
import { cardHeight, cardMaxWidth } from "../../styles/constants"
import { theme, typography } from "../../utils"

const CourseGridWrapper = styled.a`
  text-decoration: none;
  display: block;
  max-width: ${cardMaxWidth}em;
  height: 18em;
  border-radius: 1px;
  position: relative;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  background: red;

  @media (min-width: 600px) {
    height: ${cardHeight}em;
  }
`
const styledSVG = css`
  position: absolute;
  top: 10%;
  left: 2.5em;
  width: 30px;

  @media (min-width: 600px) {
    width: 45px;
  }
`

const CardTextBox = styled.div`
  position: absolute;
  bottom: 0;
  display: flex;
  padding: 0em 2em 1rem 2rem;
  height: auto;
  text-align: left;

  @media (min-width: 600px) {
    margin-bottom: 1em;
    padding: 2em 2.5em;
    height: 50%;
  }

  div {
    margin-bottom: 1.8em;
    text-align: left;

    @media (min-width: 600px) {
      margin-bottom: 1.4em;
    }
  }

  h2 {
    font-size: ${typography.h3};
    font-weight: 700;
    z-index: 20;
    line-height: 1em;
    color: rgba(40, 40, 40, 0.8);
  }

  div:first-of-type {
    position: relative;
  }

  div:last-of-type {
    position: relative;
    font-size: 0.75em;
    font-weight: 500;
    padding-top: 1em;
  }

  span {
    color: #333;
    font-size: 1.2em;
    opacity: 0.8;
    z-index: 20;
    font-weight: 500;
    width: 50%;
    line-height: 3em;
  }
`
export interface CardExtraProps {
  variant: "simple" | "Illustration"
  title: string
  chapter: number
  url?: string
  bg?: string
}

export type CardProps = React.HTMLAttributes<HTMLDivElement> & CardExtraProps

const SimpleCard: React.FC<CardProps> = ({ title, chapter, url }) => {
  // If URL defined, the chapter is open
  if (url) {
    return (
      <ThemeProvider theme={theme}>
        <>
          <CourseGridWrapper href={`${url}`}>
            <CardSVG className={cx(styledSVG)} />
            <CardTextBox>
              <div>
                <span>{`CHAPTER ${chapter}`}</span>
                <h2>{title}</h2>
              </div>
            </CardTextBox>
          </CourseGridWrapper>
        </>
      </ThemeProvider>
    )
  }
  // Closed / Opens at
  return (
    <ThemeProvider theme={theme}>
      <>
        <CourseGridWrapper>
          <CardSVG className={cx(styledSVG)} />
          <CardTextBox>
            <div>
              <span>{`CHAPTER ${chapter}`}</span>
              <h2>{title}</h2>
            </div>
          </CardTextBox>
        </CourseGridWrapper>
      </>
    </ThemeProvider>
  )
}

export default SimpleCard
