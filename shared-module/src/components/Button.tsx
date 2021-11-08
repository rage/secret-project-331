/* eslint-disable i18next/no-literal-string */
import styled from "@emotion/styled"
import React from "react"

import { baseTheme, fontWeights, headingFont, theme, typography } from "../styles"
import { respondToOrLarger } from "../styles/respond"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: "primary" | "secondary" | "tertiary" | "outlined"
  size: "medium" | "large"
  transform?: "normal" | "uppercase"
  children?: React.ReactNode
}

const BaseButtonStyles = (props: ButtonProps) => `
  position: relative;
  display: inline-block;
  padding: ${theme.buttonSizes[props.size].padding};
  font-family: ${headingFont};
  font-weight: ${fontWeights.bold};
  line-height: 18px;
  vertical-align: baseline;
  cursor: pointer;
  user-select: none;
  text-decoration: none;
  text-align: center;
  justify-content: center;
  word-break: break-word;
  text-transform: ${props.transform === "normal" ? "capitalize" : "uppercase"};
  font-size: ${props.transform === "normal" ? "1.125rem" : "0.875rem"};
  letter-spacing: 0.02em;
  transition: all 150ms linear;
  border: 2.5px solid transparent;
  z-index: 1;

  &:hover {
    text-decoration: none;
  }

  &:focus {
    text-decoration: none;
  }

  &:disabled {
    color: ${baseTheme.colors.neutral[600]};
    background-color: ${baseTheme.colors.neutral[500]};
    border-color: ${baseTheme.colors.neutral[500]};
  }
  ${respondToOrLarger.xs} {
    word-break: unset;
  }
  ${respondToOrLarger.sm} {
    white-space: nowrap;
  }
`

export const PrimaryButtonStyles = `
  color: ${baseTheme.colors.neutral[900]};
  background-color: ${theme.primary.bg};
  border-color: ${theme.primary.hoverBorder};

  &:hover {
    color: ${theme.primary.hoverBorder};
    background-color: ${theme.primary.hoverBg};
    border-color: ${theme.primary.hoverBorder};
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
`

export const SecondaryButtonStyles = `
  color: ${theme.secondary.text};
  border-color: ${theme.secondary.hoverBorder};
  border: 1.5px solid ${theme.secondary.text};

  &:hover,
  &:focus {
    color: ${theme.secondary.hoverText};
    box-shadow: 0 0 0 1px ${theme.secondary.text};
  }

  ,
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

const TertiaryButtonStyles = `
  font-size: ${typography.paragraph};
  color: ${theme.secondary.text};
  background-color: ${baseTheme.colors.grey[800]};

  &:hover {
    color: ${baseTheme.colors.grey[800]};
    background-color: ${baseTheme.colors.neutral[100]};
  }

  ,
  &:active {
    color: ${baseTheme.colors.grey[800]};
    background-color: ${baseTheme.colors.neutral[100]};
  }

  &:disabled {
    color: ${baseTheme.colors.neutral[600]};
    background-color: ${baseTheme.colors.neutral[500]};
    border-color: ${baseTheme.colors.neutral[500]};
  }
`

const PrimaryButton = styled.button`
  ${BaseButtonStyles}
  ${PrimaryButtonStyles}
`

const SecondaryButton = styled.button`
  ${BaseButtonStyles}
  ${SecondaryButtonStyles}
`

const TertiaryButton = styled.button`
  ${BaseButtonStyles}
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
