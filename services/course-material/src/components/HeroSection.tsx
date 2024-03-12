import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useContext } from "react"

import { GlossaryContext } from "../contexts/GlossaryContext"
import { respondToOrLarger } from "../shared-module//styles/respond"
import { baseTheme, headingFont } from "../shared-module/styles"
import { INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS } from "../shared-module/utils/constants"
import { COURSE_MATERIAL_DEFAULT_BLOCK_MARGIN_REM } from "../utils/constants"

import { parseText } from "./ContentRenderer/util/textParsing"

interface TextBoxProps {
  fontColor?: string
  direction: string
}

const CENTERED_MARGIN = "0 auto"
const DEFAULT_MARGIN_MEDIUM_SCREEN = "0 0 0 45%"
const DEFAULT_MARGIN_LARGE_SCREEN = "0 0 0 35%"

// eslint-disable-next-line i18next/no-literal-string
const TextBox = styled.div<TextBoxProps>`
  display: flex;
  flex-direction: column;
  max-width: 800px;
  padding: 2rem 2.5rem 3rem 2.5rem;
  margin: 0 auto;
  text-align: ${({ direction }) => direction};
  align-items: ${({ direction }) => direction};
  justify-content: center;

  ${respondToOrLarger.md} {
    margin: ${({ direction }) =>
      direction == "center" ? CENTERED_MARGIN : DEFAULT_MARGIN_MEDIUM_SCREEN};
  }

  ${respondToOrLarger.lg} {
    margin: ${({ direction }) =>
      direction == "center" ? CENTERED_MARGIN : DEFAULT_MARGIN_LARGE_SCREEN};
  }

  h1 {
    font-weight: 700;
    z-index: 20;
    margin-bottom: 0.5rem;
    line-height: 120%;
    color: ${({ color }) => (color ? color : baseTheme.colors.gray[700])};
  }

  .chapter {
    font-size: 18px;
    color: ${({ color }) => (color ? color : baseTheme.colors.gray[700])};
    opacity: 0.9;
    text-align: ${({ direction }) => direction};
    font-weight: 500;
    font-family: ${headingFont};
    margin-bottom: 0.2rem;
    text-transform: capitalize;
  }

  span {
    color: ${({ color }) => (color ? color : baseTheme.colors.gray[700])};
    font-size: 18px;
    opacity: 0.9;
    z-index: 20;
  }
`
export interface HeroSectionProps {
  subtitle: string
  title: string
  bg?: string
  backgroundImage?: string
  fontColor?: string
  alignCenter: boolean
  alignBottom?: boolean | undefined
  backgroundColor?: string
  label?: string
  useDefaultTextForLabel?: boolean
  partiallyTransparent?: boolean
  backgroundRepeatX?: boolean
  backgroundSizeRem?: number
}

export type CardProps = React.HTMLAttributes<HTMLDivElement> & HeroSectionProps

const HeroSection: React.FC<React.PropsWithChildren<React.PropsWithChildren<CardProps>>> = ({
  title,
  subtitle,
  backgroundImage,
  fontColor,
  alignCenter,
  backgroundColor,
  label,
  partiallyTransparent,
  backgroundRepeatX,
  backgroundSizeRem,
  alignBottom,
}) => {
  const CENTER = "center"
  const LEFT = "left"
  const direction = alignCenter ? CENTER : LEFT
  const { terms } = useContext(GlossaryContext)
  // eslint-disable-next-line i18next/no-literal-string
  const backgroundVerticalAlignment = alignBottom ? "bottom" : "center"
  return (
    <div
      id="hero-section"
      className={css`
        width: 100%;
        border-radius: 1px;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        padding: 7.5em 1em;
        margin-bottom: 3rem;
        /** There should not be empty space before the hero section, so we'll undo the default block margin **/
        margin-top: -${COURSE_MATERIAL_DEFAULT_BLOCK_MARGIN_REM}rem;
        background-color: ${backgroundColor ? backgroundColor : baseTheme.colors.green["200"]};
        position: relative;

        &::after {
          background-size: ${backgroundSizeRem ?? 26}rem;
          width: 100%;
          height: 100%;
          content: "";
          opacity: 0.3;
          background-image: url(${backgroundImage});
          background-repeat: ${backgroundRepeatX ? "repeat-x" : "no-repeat"};
          background-position: center ${backgroundVerticalAlignment};
          position: absolute;
          top: 0px;
          left: 0px;
          ${respondToOrLarger.md} {
            opacity: ${partiallyTransparent ? "1" : "0.4"};
            background-position: ${direction} ${backgroundVerticalAlignment};
            background-size: ${direction == "center" ? "contain" : "22rem"};
            left: ${direction == "center" ? "0" : "30px"};
          }
          ${respondToOrLarger.lg} {
            opacity: ${partiallyTransparent ? "1" : "0.4"};
            background-position: ${direction} ${backgroundVerticalAlignment};
            background-size: ${direction == "center" ? "contain" : "26rem"};
            left: ${direction == "center" ? "0" : "40px"};
          }
        }
      `}
    >
      <TextBox color={fontColor} direction={direction}>
        <span className="chapter">{label}</span>
        <h1
          className={INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS}
          dangerouslySetInnerHTML={{ __html: parseText(title, terms).parsedText }}
        />
        <span dangerouslySetInnerHTML={{ __html: parseText(subtitle, terms).parsedText }} />
      </TextBox>
    </div>
  )
}

export default HeroSection
