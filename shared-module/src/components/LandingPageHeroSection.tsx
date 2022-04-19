import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import Button from "./Button"

export const CHAPTER_GRID_SCROLLING_DESTINATION_CLASSNAME_DOES_NOT_AFFECT_STYLING =
  "chapter-grid-scrolling-destination"

// eslint-disable-next-line i18next/no-literal-string
//const HeroWrapper = styled.div``

const TextBox = styled.div`
  display: flex;
  flex-direction: column;
  padding: 2rem 2.5rem;
  margin-bottom: 1rem;
  align-items: center;
  text-align: center;
  justify-content: center;

  h1 {
    z-index: 20;
    margin-bottom: 0.8rem;
    margin-top: 1.5rem;
    font-size: clamp(4rem, 6vw, 80px);
    font-weight: bold;
    max-width: 80rem;
    line-height: 1.1;
    text-transform: uppercase;
  }

  span {
    font-style: normal;
    font-weight: 600;
    font-size: 22px;
    line-height: 40px;
    /* or 182% */

    text-align: center;

    color: #000000;

    opacity: 0.7;
  }
  button {
    margin-top: 2rem;
    text-align: center;
  }
`
export interface LandingPageHeroSectionProps {
  title: string
  backgroundImage?: string
  backgroundColor?: string
}

export type CardProps = React.HTMLAttributes<HTMLDivElement> & LandingPageHeroSectionProps

const LandingPageHeroSection: React.FC<CardProps> = ({
  title,
  children,
  backgroundImage,
  backgroundColor,
}) => {
  const { t } = useTranslation()
  return (
    <div
      className={css`
        width: 100%;
        border-radius: 1px;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        padding: 7.5em 1em;
        ${backgroundColor && `background-color: ${backgroundColor};`}
        ${backgroundImage &&
        `background-image: url(${backgroundImage});
        background-repeat: no-repeat;
        background-position: center center;`}
      `}
    >
      <TextBox>
        <h1>{title}</h1>
        {children}
        <Button
          variant="primary"
          size="large"
          onClick={(e) => {
            e.preventDefault()
            const firstChapterGrid = document.getElementsByClassName(
              CHAPTER_GRID_SCROLLING_DESTINATION_CLASSNAME_DOES_NOT_AFFECT_STYLING,
            )[0]
            if (!firstChapterGrid) {
              // eslint-disable-next-line i18next/no-literal-string
              console.warn("Cannot find scroll destination")
              return
            }
            // eslint-disable-next-line i18next/no-literal-string
            firstChapterGrid.scrollIntoView({ behavior: "smooth" })
          }}
        >
          {t("start-course")}
        </Button>
      </TextBox>
    </div>
  )
}

export default LandingPageHeroSection
