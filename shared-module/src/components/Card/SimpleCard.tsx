import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import CardSVG from "../../img/cardNext.svg"
import { headingFont, typography } from "../../styles"
import { cardMaxWidth } from "../../styles/constants"
import { respondToOrLarger } from "../../styles/respond"

import CardOpensTextOverlay from "./CardOpenTextOverlay"

import { CardExtraProps } from "."

export interface BackgroundProps {
  bg: string | undefined
}

export const BackgroundStyles = ({ bg }: BackgroundProps) => {
  const CARD_BACKGROUND_STYLES = `
    background-color: ${bg ? bg : "#fff"};
  `
  return CARD_BACKGROUND_STYLES
}
const StCardSvg = styled(CardSVG)`
  width: 40px;
  opacity: 0.8;
  color: #fff;
`

// eslint-disable-next-line i18next/no-literal-string
const CardContentWrapper = styled.div`
  display: flex;
  height: 100%;
  text-align: left;
  flex-direction: column;
  word-break: break-all;
  ${BackgroundStyles}

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

const SimpleCard: React.FC<CardProps> = ({ title, chapterNumber, open, date, time, bg }) => {
  const { t } = useTranslation()

  return (
    <div
      className={css`
        max-width: ${cardMaxWidth}rem;
        border-radius: 1px;
        position: relative;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        background: #48cfad;
        aspect-ratio: 1/1;
      `}
    >
      <CardContentWrapper bg={bg}>
        <CardOpensTextOverlay open={open} date={date} time={time} />
        {open && (
          <div
            className={css`
              padding: 2rem;
              ${respondToOrLarger.lg} {
                padding: 3rem;
              }
            `}
          >
            <StCardSvg />
          </div>
        )}

        <div
          className={css`
            flex: 1;
          `}
        ></div>

        <div
          className={css`
            flex: 1 1 auto;
            padding: 2rem;
            ${respondToOrLarger.lg} {
              padding: 3rem;
            }
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

export default SimpleCard
