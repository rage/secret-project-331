import { css, cx } from "@emotion/css"
import { ThemeProvider } from "@emotion/react"
import styled from "@emotion/styled"
import React from "react"

import CardSVG from "../../img/cardNext.svg"
import { cardDefaultMargin, wideContainerWidth } from "../../styles/constants"
import { theme } from "../../utils"

const CourseGridWrapper = styled.a`
  background: rgba(247, 227, 83, 0.8);
  text-decoration: none;
  display: block;
  max-width: ${wideContainerWidth / 2 - cardDefaultMargin * 2}px;
  max-height: ${wideContainerWidth / 2 - cardDefaultMargin * 2}px;
  height: ${wideContainerWidth / 2 - cardDefaultMargin * 2}px;
  margin: ${cardDefaultMargin}px;
  box-sizing: content-box;
  border-radius: 1px;
  position: relative;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  &:hover {
    /*     box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2); */
    border: none;
  }
  &::before,
  &::after {
    box-sizing: content-box;
  }
`
const styledSVG = css`
  position: absolute;
  top: 10%;
  left: 40px;
`

const CardTextBox = styled.div`
  position: absolute;
  bottom: 0;
  display: flex;
  padding: 2rem 2.5rem;
  height: 50%;
  text-align: left;
  margin-bottom: 1rem;

  div {
    margin-bottom: 1.4rem;
    text-align: left;
  }

  h2 {
    font-family: "Josefin Sans", sans-serif;
    font-size: 50px;
    font-weight: 400;
    word-break: break-word;
    z-index: 20;
    margin-bottom: 0.6rem;
    margin-top: 1.5rem;
    line-height: 1.1;
  }

  div:first-of-type {
    position: relative;
  }

  div:last-of-type {
    position: relative;
    font-size: 12px;
    font-weight: 500;
    font-family: "Josefin Sans", sans-serif;
    padding-top: 1rem;
  }

  span {
    color: #202020;
    font-size: 1.2rem;
    opacity: 0.8;
    z-index: 20;
    width: 50%;
  }
`
export interface CardExtraProps {
  variant: "simple" | "graphics"
  title: string
  chapter: number
  bg?: string
}

export type CardProps = React.HTMLAttributes<HTMLDivElement> & CardExtraProps

const SimpleCard: React.FC<CardProps> = ({ title, chapter }) => {
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
