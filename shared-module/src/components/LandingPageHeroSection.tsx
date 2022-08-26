import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { useTranslation } from "react-i18next"

import DefaultSVG from "../img/hero-default-bg-image.svg"
import { baseTheme } from "../styles"
import { respondToOrLarger } from "../styles/respond"

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
    font-size: clamp(2.4rem, 4vw, 60px);
    font-weight: bold;
    max-width: 100%;
    line-height: 1.1;

    ${respondToOrLarger.md} {
      width: 50vw;
    }
  }

  .hero-subtitle {
    width: 100%;
    ${respondToOrLarger.md} {
      width: 600px;
    }
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

const StyledSVG = styled(DefaultSVG)`
  position: absolute;
  top: 0;
  right: 0;
  z-index: 9;
`
export interface LandingPageHeroSectionProps {
  title: string
  backgroundImage?: string
  backgroundColor?: string
  variant?: string
}

export type CardProps = React.HTMLAttributes<HTMLDivElement> & LandingPageHeroSectionProps

const LandingPageHeroSection: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<CardProps>>
> = ({ title, children, backgroundImage, backgroundColor }) => {
  const { t } = useTranslation()
  return (
    <div
      className={css`
        width: 100%;
        border-radius: 1px;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        padding: 5em 1em;
        ${backgroundColor
          ? `background-color: ${backgroundColor};`
          : `background: ${baseTheme.colors.clear[100]};`}
        ${backgroundImage &&
        `background-image: url(${backgroundImage});
        background-repeat: no-repeat;
        background-position: center center;`}
      `}
    >
      {backgroundImage === undefined && <StyledSVG />}
      <TextBox>
        <h1>{title}</h1>
        <div className="hero-subtitle">{children}</div>
        <Button
          variant="primary"
          size="large"
          className={css`
            z-index: 99 !important;
          `}
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
