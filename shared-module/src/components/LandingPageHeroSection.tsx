import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import Button from "./Button"

export const CHAPTER_GRID_SCROLLING_DESTINATION_CLASSNAME_DOES_NOT_AFFECT_STYLING =
  "chapter-grid-scrolling-destination"

// eslint-disable-next-line i18next/no-literal-string
const HeroWrapper = styled.div`
  width: 100%;
  border-radius: 1px;
  transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  padding: 7.5em 1em;
`

const TextBox = styled.div`
  display: flex;
  flex-direction: column;
  padding: 2rem 2.5rem;
  margin-bottom: 1rem;
  align-items: center;
  text-align: center;
  justify-content: center;

  h1 {
    font-weight: 400;
    z-index: 20;
    margin-bottom: 0.8rem;
    margin-top: 1.5rem;
    font-size: clamp(4rem, 6vw, 80px);
    max-width: 1000px;
    line-height: 1.2;
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
    text-align: center;
  }
`
export interface LandingPageHeroSectionProps {
  title: string
  bg?: string
}

export type CardProps = React.HTMLAttributes<HTMLDivElement> & LandingPageHeroSectionProps

const LandingPageHeroSection: React.FC<CardProps> = ({ title, children }) => {
  const { t } = useTranslation()
  return (
    <HeroWrapper>
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
          disabled
        >
          {t("start-course")}
        </Button>
      </TextBox>
    </HeroWrapper>
  )
}

export default LandingPageHeroSection
