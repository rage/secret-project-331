import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import CardSVG from "../../img/cardNext.svg"
import { baseTheme, typography } from "../../styles"
import { cardHeight, cardMaxWidth } from "../../styles/constants"

import { CardExtraProps } from "."

const CourseGridWrapper = styled.a`
  text-decoration: none;
  display: block;
  max-width: ${cardMaxWidth}em;
  height: ${cardHeight}em;
  border-radius: 1px;
  position: relative;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  background: #48cfad;

  @media (max-width: 600px) {
    height: ${cardHeight * 0.75}em;
  }
`

const CardContentWrapper = styled.div`
  display: flex;
  height: 100%;
  text-align: left;
  flex-direction: column;

  h2 {
    font-size: ${typography.h3};
    font-weight: 700;
    z-index: 20;
    line-height: 1em;
    color: rgba(40, 40, 40, 0.8);
  }

  span {
    color: ${baseTheme.colors.grey[800]};
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

export type CardProps = React.HTMLAttributes<HTMLDivElement> & CardExtraProps

const SimpleCard: React.FC<CardProps> = ({ title, chapterNumber, url, open, bg, date, time }) => {
  // If URL defined, the chapter is open

  const fetchOpensText = () => {
    if (date && time) {
      return (
        <>
          <div>AVAILABLE</div>
          <div>
            {date} at {time}
          </div>
        </>
      )
    } else if (time) {
      return (
        <>
          <div>OPENS IN</div>
          <div>{time}</div>
        </>
      )
    } else if (open) {
      return <span>OPENS NOW!</span>
    } else {
      return <span>CLOSED</span>
    }
  }
  return (
    <CourseGridWrapper
      className={css`
        background: ${bg};
      `}
      // Pass href={url} if url defined
      {...(url ? { href: url } : {})}
    >
      <CardContentWrapper>
        {!open && !url ? (
          <div
            className={css`
              flex: 0 1 auto;
              text-align: center;
              background: #cac9c9;
              padding: 2em;
            `}
          >
            {fetchOpensText()}
          </div>
        ) : (
          <div
            className={css`
              flex: 0 1 auto;
              padding: 2em 2.5em 0 2.5em;
            `}
          >
            <CardSVG />
          </div>
        )}
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
              <span>{`CHAPTER ${chapterNumber ?? ""}`}</span>
              <h2>{title}</h2>
            </div>
          </div>
        </div>
      </CardContentWrapper>
    </CourseGridWrapper>
  )
}

export default SimpleCard
