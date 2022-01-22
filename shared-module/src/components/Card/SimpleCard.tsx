import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import CardSVG from "../../img/cardNext.svg"
import { baseTheme, typography } from "../../styles"
import { cardHeight, cardMaxWidth } from "../../styles/constants"
import { respondToOrLarger } from "../../styles/respond"

import { CardExtraProps } from "."

// eslint-disable-next-line i18next/no-literal-string
const CourseGridWrapper = styled.a`
  text-decoration: none;
  display: block;
  max-width: ${cardMaxWidth}em;
  height: ${cardHeight * 0.75}em;
  border-radius: 1px;
  position: relative;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  background: #48cfad;

  ${respondToOrLarger.sm} {
    height: ${cardHeight}em;
  }
`
const StCardSvg = styled(CardSVG)`
  width: 40px;
  opacity: 0.8;
`

const CardContentWrapper = styled.div`
  display: flex;
  height: 100%;
  text-align: left;
  flex-direction: column;
  word-break: break-all;

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
  ${respondToOrLarger.lg} {
    word-break: normal;
  }
`

export type CardProps = React.HTMLAttributes<HTMLDivElement> & CardExtraProps

const SimpleCard: React.FC<CardProps> = ({ title, chapterNumber, url, open, bg, date, time }) => {
  const { t } = useTranslation()
  // If URL defined, the chapter is open

  const fetchOpensText = () => {
    if (date && time) {
      return (
        <>
          <div
            className={css`
              text-transform: uppercase;
            `}
          >
            {t("available")}
          </div>
          <div>{t("on-date-at-time", { date, time })}</div>
        </>
      )
    } else if (time) {
      return (
        <>
          <div
            className={css`
              text-transform: uppercase;
            `}
          >
            {t("opens-in")}
          </div>
          <div>{time}</div>
        </>
      )
    } else if (open) {
      return (
        <span
          className={css`
            text-transform: uppercase;
          `}
        >
          {t("opens-now")}
        </span>
      )
    } else {
      return (
        <span
          className={css`
            text-transform: uppercase;
          `}
        >
          {t("closed")}
        </span>
      )
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
              padding: 2rem;
            `}
          >
            {fetchOpensText()}
          </div>
        ) : (
          <div
            className={css`
              flex: 0 1 auto;
              padding: 3rem 2.5rem 0 2.5rem;
            `}
          >
            <StCardSvg />
          </div>
        )}
        <div
          className={css`
            flex: 1 1 auto;
            padding: 0em 2.5rem 3rem 2.5rem;
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
              <span
                className={css`
                  text-transform: uppercase;
                  font-family: Josefin sans, "sans-serif";
                `}
              >
                {t("chapter-chapter-number", { number: chapterNumber })}
              </span>
              <h2>{title}</h2>
            </div>
          </div>
        </div>
      </CardContentWrapper>
    </CourseGridWrapper>
  )
}

export default SimpleCard
