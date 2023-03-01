import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import { baseTheme, headingFont } from "../styles"
import { respondToOrLarger } from "../styles/respond"
import { INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS } from "../utils/constants"

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
    opacity: 0.7;
    text-align: ${({ direction }) => direction};
    font-weight: 500;
    font-family: ${headingFont};
    margin-bottom: 0.2rem;
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
  backgroundColor?: string
  chapter?: string
  useDefaultTextForLabel?: boolean
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
}) => {
  const CENTER = "center"
  const LEFT = "left"
  const direction = alignCenter ? CENTER : LEFT
  console.log({ backgroundImage, backgroundColor })
  return (
    <div
      id="hero-section"
      className={css`
        width: 100%;
        border-radius: 1px;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        padding: 7.5em 1em;
        margin-bottom: 3rem;
        background-color: ${backgroundColor ? backgroundColor : baseTheme.colors.green["400"]};
        background-size: cover;
        position: relative;

        &::after {
          background-size: 26rem;
          width: 100%;
          height: 100%;
          content: "";
          opacity: 0.3;
          background-image: url(${backgroundImage});
          background-repeat: no-repeat;
          background-position: center center;
          position: absolute;
          top: 0px;
          left: 0px;
          ${respondToOrLarger.md} {
            opacity: ${direction == "center" ? "0.3" : "1"};
            background-position: ${direction} center;
            background-size: ${direction == "center" ? "30rem" : "22rem"};
            left: ${direction == "center" ? "0" : "30px"};
          }
          ${respondToOrLarger.lg} {
            opacity: ${direction == "center" ? "0.3" : "1"};
            background-position: ${direction} center;
            background-size: ${direction == "center" ? "30rem" : "26rem"};
            left: ${direction == "center" ? "0" : "40px"};
          }
        }
      `}
    >
      <TextBox color={fontColor} direction={direction}>
        <span className="chapter">{label}</span>
        <h1 className={INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS}>{title}</h1>
        <span>{subtitle}</span>
      </TextBox>
    </div>
  )
}

export default HeroSection
