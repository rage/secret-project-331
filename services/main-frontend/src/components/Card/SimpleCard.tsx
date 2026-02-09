"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { LockKeyhole } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import CardDeadlineOverlay, { cardTopBandStyle } from "./CardDeadlineOverlay"
import CardOpensTextOverlay from "./CardOpenTextOverlay"
import CardOpensText from "./CardOpensText"

import { CardExtraProps } from "."

import PseudoContentLink from "@/components/PseudoContentLink"
import CardSVG from "@/shared-module/common/img/cardNext.svg"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { cardMaxWidth } from "@/shared-module/common/styles/constants"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { humanReadableDateTime } from "@/shared-module/common/utils/time"

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

  span.chapter-number {
    color: ${baseTheme.colors.clear[100]};
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
  points,
  showLock,
  isLocked,
  deadline,
  exerciseDeadline,
  exerciseDeadlinesMultiple,
}) => {
  const { t, i18n } = useTranslation()

  const shouldLink = url && (open || allowedToPreview)
  const formattedDeadline = humanReadableDateTime(deadline, i18n.language) ?? null
  const formattedExerciseDeadline = humanReadableDateTime(exerciseDeadline, i18n.language) ?? null
  const hasDeadlines = !!(formattedDeadline || formattedExerciseDeadline)

  const topBandsWrapperStyle = css`
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    z-index: 100;
    display: flex;
    flex-direction: column;
  `

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
        {hasDeadlines ? (
          <div className={topBandsWrapperStyle}>
            {!open && (
              <div className={cardTopBandStyle}>
                <CardOpensText open={open} date={date} time={time} />
              </div>
            )}
            <CardDeadlineOverlay
              formattedDeadline={formattedDeadline}
              formattedExerciseDeadline={formattedExerciseDeadline}
              exerciseDeadlinesMultiple={!!exerciseDeadlinesMultiple}
            />
          </div>
        ) : (
          <CardOpensTextOverlay open={open} date={date} time={time} />
        )}
        <div
          className={css`
            position: absolute;
            top: 1rem;
            right: 1rem;
            z-index: 102;
            display: flex;
            align-items: center;
            gap: 0.5rem;
          `}
        >
          {isLocked && (
            <div
              className={css`
                color: #fff;
                background: rgba(0, 0, 0, 0.5);
                padding: 0.5rem;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                backdrop-filter: blur(4px);
              `}
            >
              <LockKeyhole size={20} />
            </div>
          )}
          {points && (
            <div
              className={css`
                background: rgba(0, 0, 0, 0.5);
                color: #fff;
                padding: 0.4rem 0.8rem;
                border-radius: 0.5rem;
                font-size: 0.875rem;
                font-weight: 600;
                backdrop-filter: blur(4px);
              `}
            >
              {Math.round(points.awarded)} / {points.max}
            </div>
          )}
        </div>
        {showLock && (
          <div
            role="img"
            aria-label={t("chapter-locked-message")}
            className={css`
              position: absolute;
              top: 1rem;
              left: 1rem;
              z-index: 102;
              color: #fff;
              background: rgba(0, 0, 0, 0.5);
              padding: 0.5rem;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              backdrop-filter: blur(4px);
            `}
          >
            <LockKeyhole size={20} />
          </div>
        )}
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
                <PseudoContentLink
                  href={url}
                  data-testid={chapterNumber ? `chapter-link-${chapterNumber}` : undefined}
                >
                  <span
                    className={`${css`
                      font-family: ${headingFont};
                    `} chapter-number`}
                  >
                    {t("chapter-chapter-number", { number: chapterNumber })}
                  </span>
                  <h2>{title}</h2>
                </PseudoContentLink>
              ) : (
                <>
                  <span
                    className={`${css`
                      font-family: ${headingFont};
                    `} chapter-number`}
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
