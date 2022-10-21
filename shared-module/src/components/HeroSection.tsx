import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import { baseTheme, typography } from "../styles"
import { respondToOrLarger } from "../styles/respond"
import { INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS } from "../utils/constants"

// eslint-disable-next-line i18next/no-literal-string
const TextBox = styled.div`
  padding: 1rem 1rem 1rem 1rem;
  margin-bottom: 1rem;
  text-align: center;
  width: 100%;

  ${respondToOrLarger.md} {
    width: 90%;
  }
  ${respondToOrLarger.lg} {
    width: 50%;
  }

  h1 {
    font-weight: 400;
    z-index: 20;
    margin-bottom: 0.5rem;
    margin-top: 1.5rem;
    line-height: 120%;
  }

  span {
    color: #202020;
    font-size: 1.2rem;
    opacity: 0.8;
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
  backgroundColor?: string
}

export type CardProps = React.HTMLAttributes<HTMLDivElement> & HeroSectionProps

const HeroSection: React.FC<React.PropsWithChildren<React.PropsWithChildren<CardProps>>> = ({
  title,
  subtitle,
  backgroundImage,
  backgroundColor,
}) => {
  return (
    <div
      id="hero-section"
      className={css`
        background: ${baseTheme.colors.green[200]};
        width: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 1px;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        padding: 2.5em 1em;

        ${respondToOrLarger.md} {
          padding: 4.5em 1em;
        }
        ${respondToOrLarger.lg} {
          padding: 6.5em 1em;
        }
        margin-bottom: 3rem;
        ${backgroundColor && `background-color: ${backgroundColor}`}
        ${backgroundImage &&
        `background-image: url(${backgroundImage});
        background-repeat: no-repeat;
        background-position: center center;`}
        background-size: auto;
        ${respondToOrLarger.xxxxxl} {
          background-size: contain;
        }
      `}
    >
      <TextBox>
        <h1 className={INCLUDE_THIS_HEADING_IN_HEADINGS_NAVIGATION_CLASS}>{title}</h1>
        <span>{subtitle}</span>
      </TextBox>
    </div>
  )
}

export default HeroSection
