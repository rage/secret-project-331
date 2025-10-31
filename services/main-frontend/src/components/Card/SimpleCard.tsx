"use client"
import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import CardOpensTextOverlay from "./CardOpenTextOverlay"
import PseudoContentLink from "./PseudoContentLink"

import { CardExtraProps } from "."

import CardSVG from "@/shared-module/common/img/cardNext.svg"
import { headingFont } from "@/shared-module/common/styles"
import { cardMaxWidth } from "@/shared-module/common/styles/constants"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"

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

const CardContentWrapper = styled.div`
  display: flex;
  height: 100%;
  text-align: left;
  flex-direction: column;
  overflow-wrap: break-word;
  ${BackgroundStyles}

  &:hover {
    filter: brightness(1.1) contrast(0.9);
  }

  h2 {
    z-index: 20;
    color: #fff;
    font-weight: 500;
    line-height: 110%;
    font-size: 1.875rem;

    ${respondToOrLarger.lg} {
      font-size: clamp(28px, 2.7rem, 46px);
    }
  }

  span {
    color: #f5f6f7;
    font-size: clamp(16px, 1em, 20px);
    opacity: 0.9;
    z-index: 20;
    font-weight: 500;
    width: 50%;
    line-height: 2.5em;
  }
`
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const StyledSVG = (Image: any) => {
  return (
    <Image
      className={css`
        position: absolute;
        z-index: 99;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
      `}
    />
  )
}

export type CardProps = React.HTMLAttributes<HTMLDivElement> & CardExtraProps

const SimpleCard: React.FC<React.PropsWithChildren<CardProps>> = ({
  title,
  chapterNumber,
  open,
  date,
  time,
  bg,
  backgroundImage,
  url,
  allowedToPreview,
}) => {
  const { t } = useTranslation()

  const shouldLink = url && (open || allowedToPreview)

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
        {backgroundImage && StyledSVG(backgroundImage)}
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
            padding: 2rem 2rem 3rem 2rem;
            ${respondToOrLarger.lg} {
              padding: 3rem 3rem 4rem 3rem;
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
              {shouldLink ? (
                <PseudoContentLink href={url}>
                  <span
                    className={css`
                      font-family: ${headingFont};
                    `}
                  >
                    {t("chapter-chapter-number", { number: chapterNumber })}
                  </span>
                  <h2>{title}</h2>
                </PseudoContentLink>
              ) : (
                <>
                  <span
                    className={css`
                      font-family: ${headingFont};
                    `}
                  >
                    {t("chapter-chapter-number", { number: chapterNumber })}
                  </span>
                  <h2>{title}</h2>
                </>
              )}
            </div>
          </div>
        </div>
      </CardContentWrapper>
    </div>
  )
}

export default SimpleCard
