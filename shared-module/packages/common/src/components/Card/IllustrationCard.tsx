import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import { baseTheme, headingFont } from "../../styles"
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

const CardContentWrapper = styled.div`
  display: flex;
  height: 100%;
  text-align: left;
  flex-direction: column;
  overflow: hidden;
  overflow-wrap: break-word;
  ${BackgroundStyles}

  h2 {
    font-weight: 600;
    z-index: 20;
    line-height: 1.2;
    color: ${baseTheme.colors.gray[700]};
    margin-top: 5px;
    font-size: clamp(26px, 2.2vw, 30px);
    opacity: 0.9;
    overflow: hidden;
    text-overflow: ellipsis;

    /* For multi-line truncation: */
    display: -webkit-box;
    -webkit-line-clamp: 3; /* Limit to 3 lines */
    -webkit-box-orient: vertical;
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
        background: #f2f2f2;
        aspect-ratio: 1/1;
        padding: 10px;
      `}
    >
      <CardContentWrapper bg={bg}>
        <CardOpensTextOverlay open={open} date={date} time={time} />
        <div
          className={css`
            width: 100%;
            height: 23.163rem;
            transition: transform 0.2s;
            ${backgroundImage &&
            `background-image: url(${backgroundImage});
              background-repeat: no-repeat;
              background-color: ${bg};
              background-position: center center;
              background-size: cover;
              `}

            &:hover {
              transform: scale(1.1);
            }
          `}
        ></div>
        <div
          className={css`
            flex: 1 1 auto;
            padding: 1rem;
            position: relative;
            background: #fff;

            ${respondToOrLarger.md} {
              padding: 1.6rem 1.25rem;
            }
          `}
        >
          <div
            className={css`
              position: absolute;
              top: -15px;
              left: 10px;
              ${respondToOrLarger.md} {
                left: 30px;
              }
            `}
          >
            <span
              className={css`
                font-family: ${headingFont};
                min-width: 18px;
                font-weight: 500;
                color: ${baseTheme.colors.blue[600]} !important;
                background: #edf1f4;
                border: 3px solid #fff;
                border-radius: 20px;
                font-size: 0.7rem;
                padding: 0.2rem 0.6rem 0.3rem 0.6rem;

                ${respondToOrLarger.md} {
                  font-size: 0.9rem;
                }
              `}
            >
              {t("chapter-chapter-number", { number: chapterNumber })}
            </span>
          </div>

          <h2>{title}</h2>
        </div>
      </CardContentWrapper>
    </div>
  )
}

export default IllustrationCard
