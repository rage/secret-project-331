"use client"

import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { LockKeyhole } from "@vectopus/atlas-icons-react"
import React from "react"
import { useTranslation } from "react-i18next"

import CardOpensTextOverlay from "./CardOpenTextOverlay"

import { CardExtraProps } from "."

import PseudoContentLink from "@/components/PseudoContentLink"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { cardMaxWidth } from "@/shared-module/common/styles/constants"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { humanReadableDateTime } from "@/shared-module/common/utils/time"

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
    /* stylelint-disable-next-line property-no-deprecated */
    -webkit-box-orient: vertical;
  }
`

export type CardProps = React.HTMLAttributes<HTMLDivElement> & CardExtraProps

const IllustrationCard: React.FC<React.PropsWithChildren<CardProps>> = ({
  title,
  chapterNumber,
  bg,
  backgroundImage,
  open,
  date,
  time,
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
  const exerciseDeadlineText = formattedExerciseDeadline
    ? exerciseDeadlinesMultiple
      ? t("chapter-card-deadline-varies", { date: formattedExerciseDeadline })
      : `${t("chapter-card-exercise-deadline")} ${formattedExerciseDeadline}`
    : null
  const deadlineText = formattedDeadline
    ? `${t("chapter-card-deadline")} ${formattedDeadline}`
    : null

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
            background: #fff;

            ${respondToOrLarger.md} {
              padding: 1.6rem 1.25rem;
            }
          `}
        >
          {shouldLink ? (
            <PseudoContentLink
              href={url}
              data-testid={chapterNumber ? `chapter-link-${chapterNumber}` : undefined}
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
              {(deadlineText || exerciseDeadlineText) && (
                <div
                  className={css`
                    margin-top: 0.5rem;
                    color: ${baseTheme.colors.gray[700]};
                    font-size: 0.85rem;
                    line-height: 1.35;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.35rem 0.7rem;
                  `}
                >
                  {deadlineText && <span>{deadlineText}</span>}
                  {exerciseDeadlineText && <span>{exerciseDeadlineText}</span>}
                </div>
              )}
            </PseudoContentLink>
          ) : (
            <>
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
              {(deadlineText || exerciseDeadlineText) && (
                <div
                  className={css`
                    margin-top: 0.5rem;
                    color: ${baseTheme.colors.gray[700]};
                    font-size: 0.85rem;
                    line-height: 1.35;
                    display: flex;
                    flex-wrap: wrap;
                    gap: 0.35rem 0.7rem;
                  `}
                >
                  {deadlineText && <span>{deadlineText}</span>}
                  {exerciseDeadlineText && <span>{exerciseDeadlineText}</span>}
                </div>
              )}
            </>
          )}
        </div>
      </CardContentWrapper>
    </div>
  )
}

export default IllustrationCard
