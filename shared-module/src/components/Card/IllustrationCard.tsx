import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme, headingFont, typography } from "../../styles"
import { cardMaxWidth } from "../../styles/constants"
import { respondToOrLarger } from "../../styles/respond"

// import Background from "./background.svg"

import { CardExtraProps } from "."

export interface BackgroundProps {
  bg: string | undefined
  backgroundImage?: string
}

// eslint-disable-next-line i18next/no-literal-string
const CardContentWrapper = styled.div`
  display: flex;
  height: 100%;
  text-align: left;
  flex-direction: column;
  word-break: break-all;
  background-color: ${baseTheme.colors.grey[200]};

  h2 {
    font-size: ${typography.h3};
    font-weight: 700;
    z-index: 20;
    line-height: 1em;
    color: #fff;
  }

  span {
    color: #f5f6f7;
    font-size: 1.2em;
    /* opacity: 0.8; */
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

const IllustrationCard: React.FC<CardProps> = ({
  title,
  chapterNumber,
  open,
  date,
  time,
  bg,
  backgroundImage,
}) => {
  const { t } = useTranslation()

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
    <div
      className={css`
        max-width: ${cardMaxWidth}em;
        border-radius: 1px;
        position: relative;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        background: #48cfad;
        aspect-ratio: 1/1;
      `}
    >
      <CardContentWrapper>
        <div
          className={css`
            flex: 1;
          `}
        >
          {/* <Background /> */}
          {!open && (
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
          )}
        </div>
        <div
          className={css`
            // IMPORTANT: the height of this needs to be hardcoded because the cover images assume this area to be of certain size. If you change this, these course card images will no longer look right.
            height: 250px;
            background: ${bg};
            padding: 3rem 2.5rem 3rem 2.5rem;
          `}
        >
          <div
            className={css`
              display: flex;
              flex-direction: column;
              height: 100%;
            `}
          >
            <div className={css``}>
              <span
                className={css`
                  text-transform: uppercase;
                  font-family: ${headingFont};
                `}
              >
                {t("chapter-chapter-number", { number: chapterNumber })}
              </span>
              <h2>{title}</h2>
            </div>
          </div>
        </div>
      </CardContentWrapper>
    </div>
  )
}

export default IllustrationCard
