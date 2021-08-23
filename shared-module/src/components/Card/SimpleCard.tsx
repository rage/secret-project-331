import { css } from "@emotion/css"
import { ThemeProvider } from "@emotion/react"
import styled from "@emotion/styled"
import React from "react"

import CardSVG from "../../img/cardNext.svg"
import { cardHeight, cardMaxWidth } from "../../styles/constants"
import { theme } from "../../utils"

const CourseGridWrapper = styled.a`
  text-decoration: none;
  display: block;
  max-width: ${cardMaxWidth}em;
  height: ${cardHeight}em;
  border-radius: 1px;
  position: relative;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
`

const CardContentWrapper = styled.div`
  display: flex;
  height: 100%;
  flex-direction: column;
  margin-bottom: 1em;

  h2 {
    font-size: 3.125em;
    font-weight: 700;
    z-index: 20;
    line-height: 1em;
    color: rgba(40, 40, 40, 0.8);
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
  @media (max-width: 37.5em) {
    word-break: break-all;
  }
`
export interface CardExtraProps {
  variant: "simple" | "Illustration"
  title: string
  chapter: number
  url?: string
  closedUntil?: string
  bg?: string
}

export type CardProps = React.HTMLAttributes<HTMLDivElement> & CardExtraProps

const SimpleCard: React.FC<CardProps> = ({ title, chapter, url, closedUntil, bg }) => {
  // If URL defined, the chapter is open
  return (
    <ThemeProvider theme={theme}>
      <>
        <CourseGridWrapper
          className={css`
            background: ${bg};
          `}
          // Pass href={url} if url defined
          {...(url ? { href: url } : {})}
        >
          <CardContentWrapper>
            <div
              className={css`
                flex: 0 1 auto;
                padding: 2em 2.5em 0 2.5em;
              `}
            >
              <CardSVG />
            </div>
            <div
              className={css`
                flex: 1 1 auto;
                padding: 0em 2.5em 2em 2.5em;
              `}
            >
              <div
                className={css`
                  display: flex;
                  flex-direction: column;
                  height: 100%;
                `}
              >
                <div
                  className={css`
                    margin-top: auto;
                  `}
                >
                  <span>{`CHAPTER ${chapter}`}</span>
                  <h2>{title}</h2>
                </div>
              </div>
            </div>
            {closedUntil && !url ? (
              <div
                className={css`
                  flex: 0 1 auto;
                  text-align: center;
                  background: #cac9c9;
                  padding: 2em;
                `}
              >
                {closedUntil}
              </div>
            ) : null}
          </CardContentWrapper>
        </CourseGridWrapper>
      </>
    </ThemeProvider>
  )
}

export default SimpleCard
