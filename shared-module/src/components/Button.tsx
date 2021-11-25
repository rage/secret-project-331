import styled from "@emotion/styled"
import React from "react"

import { baseTheme, fontWeights, headingFont, theme } from "../styles"
import { respondToOrLarger } from "../styles/respond"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: "primary" | "secondary" | "tertiary" | "outlined"
  size: "medium" | "large"
  transform?: "normal" | "uppercase"
  children?: React.ReactNode
}

// BaseButtonStyles is the primary button
export const BASE_BUTTON_STYLES = `
  position: relative;
  display: inline-block;
  padding: ${theme.buttonSizes["large"].padding};
  font-family: ${headingFont};
  font-weight: ${fontWeights.normal};
  line-height: normal;
  vertical-align: baseline;
  cursor: pointer;
  user-select: none;
  text-decoration: none;
  text-align: center;
  justify-content: center;
  word-break: break-word;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  transition: all 150ms linear;
  border: 2.5px solid transparent;
  z-index: 1;

  color: ${baseTheme.colors.neutral[900]};
  background-color: ${theme.primary.bg};
  border-color: ${theme.primary.hoverBorder};

  &:hover {
    color: ${theme.primary.hoverBorder};
    background-color: ${theme.primary.hoverBg};
    border-color: ${theme.primary.hoverBorder};
    text-decoration: none;
  }

  &:active {
    color: ${theme.primary.hoverText};
    background-color: ${theme.primary.hoverBg};
    border-color: ${theme.primary.hoverBorder};
  }

  &:disabled {
    color: ${baseTheme.colors.neutral[600]};
    background-color: ${baseTheme.colors.neutral[500]};
    border-color: ${baseTheme.colors.neutral[500]};
  }

  &:focus {
    text-decoration: none;
  }

  ${respondToOrLarger.xs} {
    word-break: unset;
  }
  ${respondToOrLarger.sm} {
    white-space: nowrap;
  }
`

export const PrimaryButtonStyles = (props: ButtonProps) => {
  const PRIMARY_BUTTON_STYLES = `
    text-transform: ${props.transform === "normal" ? "capitalize" : "uppercase"};
    padding: ${theme.buttonSizes[props.size].padding};
  `
  return PRIMARY_BUTTON_STYLES
}

export const SecondaryButtonStyles = (props: ButtonProps) => {
  const SECONDARY_BUTTON_STYLES = `
    text-transform: ${props.transform === "normal" ? "capitalize" : "uppercase"};
    padding: ${theme.buttonSizes[props.size].padding};

    color: ${theme.secondary.text};
    background: ${theme.secondary.bg};
    border-color: ${theme.secondary.hoverBorder};
    border: 1.5px solid ${theme.secondary.text};

    &:hover,
    &:focus {
      color: ${theme.secondary.hoverText};
      box-shadow: 0 0 0 1px ${theme.secondary.text};
      border: 1.5px solid ${theme.secondary.text};
    }

    &:active {
      color: ${theme.secondary.hoverText};
      background-color: ${theme.secondary.hoverBg};
    }

    &:disabled {
      color: ${baseTheme.colors.neutral[600]};
      background-color: ${baseTheme.colors.neutral[500]};
      border-color: ${baseTheme.colors.neutral[500]};
    }
  `
  return SECONDARY_BUTTON_STYLES
}

export const TertiaryButtonStyles = (props: ButtonProps) => {
  const TERTIARY_BUTTON_STYLES = `
    text-transform: ${props.transform === "normal" ? "capitalize" : "uppercase"};
    padding: ${theme.buttonSizes[props.size].padding};

    color: ${theme.tertiary.text};
    background-color: ${theme.tertiary.bg};
    border: unset;

    &:hover {
      color: ${theme.tertiary.hoverText};
      background-color: ${theme.tertiary.hoverBg};
    }

    &:active {
      color: ${theme.tertiary.hoverText};
      background-color: ${theme.tertiary.activeBg};
    }

    &:disabled {
      color: ${baseTheme.colors.neutral[600]};
      background-color: ${baseTheme.colors.neutral[500]};
      border-color: ${baseTheme.colors.neutral[500]};
    }
  `
  return TERTIARY_BUTTON_STYLES
}

const PrimaryButton = styled.button`
  ${BASE_BUTTON_STYLES}
  ${PrimaryButtonStyles}
`

const SecondaryButton = styled.button`
  ${BASE_BUTTON_STYLES}
  ${SecondaryButtonStyles}
`

const TertiaryButton = styled.button`
  ${BASE_BUTTON_STYLES}
  ${TertiaryButtonStyles}
`

/* BUTTON VARIANT
PrimaryButton
SecondaryButton
GhostButton
TertiaryButton
IconButton
Link */

const Button: React.FC<ButtonProps> = (props: ButtonProps) => {
  switch (props.variant) {
    case "primary":
      return <PrimaryButton {...props} />
    case "secondary":
      return <SecondaryButton {...props} />
    case "tertiary":
      return <TertiaryButton {...props} />
    case "outlined":
      return <SecondaryButton {...props} />
    default:
      return <PrimaryButton {...props} />
  }
}

export default Button
