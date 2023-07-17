import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import { GlossaryContext } from "../contexts/GlossaryContext"
import Button from "../shared-module/components/Button"
import DefaultSVG from "../shared-module/img/hero-default-bg-image.svg"
import { baseTheme } from "../shared-module/styles"
import { respondToOrLarger } from "../shared-module/styles/respond"

import { parseText } from "./ContentRenderer/util/textParsing"

export const CHAPTER_GRID_SCROLLING_DESTINATION_CLASSNAME_DOES_NOT_AFFECT_STYLING =
  "chapter-grid-scrolling-destination"

interface TextBoxProps {
  fontColor?: string
}

// eslint-disable-next-line i18next/no-literal-string
//const HeroWrapper = styled.div``

const TextBox = styled.div<TextBoxProps>`
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
    color: ${({ color }) => (color ? color : baseTheme.colors.gray[700])};
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
    color: ${({ color }) => (color ? color : baseTheme.colors.gray[700])};
    ${respondToOrLarger.md} {
      width: 600px;
    }
  }

  span {
    font-style: normal;
    font-weight: 600;
    font-size: 22px;
    line-height: 40px;
    text-align: center;
    opacity: 0.7;
  }
  button {
    margin-top: 2rem;
    text-align: center;
    font-weight: 700;
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
  fontColor?: string
  backgroundRepeatX?: boolean
  variant?: string
}

export type CardProps = React.HTMLAttributes<HTMLDivElement> & LandingPageHeroSectionProps

const LandingPageHeroSection: React.FC<
  React.PropsWithChildren<React.PropsWithChildren<CardProps>>
> = ({ title, children, backgroundImage, backgroundColor, backgroundRepeatX, fontColor }) => {
  const { t } = useTranslation()
  const { terms } = useContext(GlossaryContext)
  return (
    <div
      className={css`
        width: 100%;
        border-radius: 1px;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        padding: 5em 1em;
        ${backgroundColor && `background-color: ${backgroundColor};`}
        ${backgroundImage &&
        `background-image: url(${backgroundImage});
        background-repeat: ${backgroundRepeatX ? "repeat-x" : "no-repeat"};
        background-position: center center;`}
        background-size: cover;
        ${respondToOrLarger.xxxxl} {
          background-size: auto;
        }
      `}
    >
      {backgroundImage === undefined && <StyledSVG />}
      <TextBox color={fontColor}>
        <h1 dangerouslySetInnerHTML={{ __html: parseText(title, terms).parsedText }} />
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
