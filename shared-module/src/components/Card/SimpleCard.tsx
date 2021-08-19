import { css, cx } from "@emotion/css"
import { ThemeProvider } from "@emotion/react"
import styled from "@emotion/styled"
import React from "react"

import { theme } from "../../utils"

const CourseGridWrapper = styled.a`
  text-decoration: none;
  display: block;
  max-width: 529px;
  height: 484px;
  border-radius: 1px;
  position: relative;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
`
const styledSVG = css`
  position: absolute;
  top: 10%;
  left: 40px;
`

const CardTextBox = styled.div`
  position: absolute;
  bottom: 0;
  right: 0;
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
  chapter: string
  bg?: string
}

export type CardProps = React.HTMLAttributes<HTMLDivElement> & CardExtraProps

const SimpleCard: React.FC<CardProps> = ({ title, chapter }) => {
  return (
    <ThemeProvider theme={theme}>
      <>
        <CourseGridWrapper>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className={cx(styledSVG)}
            width="57"
            height="40"
            viewBox="0 0 56.957 49"
          >
            <path
              id="Path_2435"
              data-name="Path 2435"
              d="M32.466,0,29.321,3.146l19.123,19.11H0v4.475H48.444L29.321,45.854,32.466,49l24.49-24.506Z"
              fill="#333"
            />
          </svg>
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
