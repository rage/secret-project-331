import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import { baseTheme, typography } from "../styles"
import { respondToOrLarger } from "../styles/respond"
import { INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS } from "../utils/constants"

interface TextBoxProps {
  fontColor?: string
}

// eslint-disable-next-line i18next/no-literal-string
const TextBox = styled.div<TextBoxProps>`
  display: flex;
  flex-direction: column;
  padding: 2rem 2.5rem 3rem 2.5rem;
  margin-bottom: 1rem;
  align-items: center;
  text-align: center;
  justify-content: center;

  h1 {
    font-weight: 700;
    z-index: 20;
    margin-bottom: 0.5rem;
    margin-top: 1.5rem;
    line-height: 120%;
    color: ${({ color }) => (color ? color : baseTheme.colors.gray[700])};
  }

  .chapter {
    color: ${({ color }) => (color ? color : baseTheme.colors.gray[700])};
    opacity: 0.8;
  }

  span {
    color: ${({ color }) => (color ? color : baseTheme.colors.gray[700])};
    font-size: 1.2rem;
    opacity: 0.7;
    z-index: 20;

    ${respondToOrLarger.sm} {
      font-size: ${typography.h5};
    }
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
}

export type CardProps = React.HTMLAttributes<HTMLDivElement> & HeroSectionProps

const HeroSection: React.FC<React.PropsWithChildren<React.PropsWithChildren<CardProps>>> = ({
  title,
  subtitle,
  backgroundImage,
  fontColor,
  alignCenter,
  backgroundColor,
  chapter,
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
        background-color: ${backgroundColor};
        background-image: url(${backgroundImage});
        background-repeat: no-repeat;
        background-position: ${direction} center;
        background-size: auto;
        ${respondToOrLarger.xxxxxl} {
          background-size: contain;
        }
      `}
    >
      <TextBox color={fontColor}>
        <span className="chapter">{chapter}</span>
        <h1 className={INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS}>{title}</h1>
        <span>{subtitle}</span>
      </TextBox>
    </div>
  )
}

export default HeroSection
