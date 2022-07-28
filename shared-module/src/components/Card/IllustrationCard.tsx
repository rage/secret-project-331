import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { headingFont, typography } from "../../styles"
import { cardMaxWidth } from "../../styles/constants"
import { respondToOrLarger } from "../../styles/respond"

import CardOpensTextOverlay from "./CardOpenTextOverlay"

import { CardExtraProps } from "."

export interface BackgroundProps {
  bg: string | undefined
  backgroundImage?: string
}

export const BackgroundStyles = ({ bg }: BackgroundProps) => {
  const CARD_BACKGROUND_STYLES = `
    background-color: ${bg ? bg : "#fff"};
  `
  return CARD_BACKGROUND_STYLES
}

// eslint-disable-next-line i18next/no-literal-string
const CardContentWrapper = styled.div`
  display: flex;
  height: 100%;
  text-align: left;
  flex-direction: column;
  word-break: break-all;
  ${BackgroundStyles}

  h2 {
    font-size: /* ${typography.h3} */ 1.8rem;
    font-weight: 400;
    z-index: 20;
    line-height: 1.2;
    color: #fff;
    margin-top: 5px;
  }

  span {
    color: #333;
    font-size: 0.8rem;
    z-index: 20;
    font-weight: 800;
    width: 50%;
    line-height: 3em;
    background-color: #f9f9f9;
    padding: 0.2rem 0.2rem 0.1rem;
  }
  ${respondToOrLarger.lg} {
    word-break: normal;
  }
`

export type CardProps = React.HTMLAttributes<HTMLDivElement> & CardExtraProps

const IllustrationCard: React.FC<React.PropsWithChildren<React.PropsWithChildren<CardProps>>> = ({
  title,
  chapterNumber,
  bg,
  backgroundImage,
  open,
  date,
  time,
}) => {
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
        <div
          className={css`
            width: 100%;
            height: 345.6px;
            ${backgroundImage &&
            `background-image: url(${backgroundImage});
              background-repeat: no-repeat;
              background-position: center center;
              background-size: contain;
              background-color: #f2f2f2;`}
          `}
        ></div>
        <div
          className={css`
            flex: 1 1 auto;
            padding: 2rem;
            background: ${bg};
            height: 200px;
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
                /* margin-top: auto; */
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

export default IllustrationCard
