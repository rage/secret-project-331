import { ThemeProvider } from "@emotion/react"
import styled from "@emotion/styled"
import React from "react"
import { border, color, space } from "styled-system"

import { baseTheme, fontWeights, headingFont, theme, typography } from "../styles"

export interface ButtonExtraProps {
  variant: "primary" | "secondary" | "tertiary"
  size: "medium" | "large"
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonExtraProps

const BaseButton = styled.button`
  position: relative;
  display: inline-block;
  padding: ${({ size }: ButtonProps) =>
    size == "medium" ? theme.buttonSizes.medium : theme.buttonSizes.large};
  font-family: ${headingFont};
  font-weight: ${fontWeights.bold};
  line-height: 18px;
  white-space: nowrap;
  vertical-align: baseline;
  cursor: pointer;
  user-select: none;
  text-decoration: none;
  text-align: center;
  justify-content: center;
  text-transform: uppercase;
  font-size: 14px !important;
  letter-spacing: 0.02em;
  transition: all 150ms linear;
  border: 2px solid;
  z-index: 1;

  &:hover {
    text-decoration: none;
  }

  &:focus {
    text-decoration: none;
  }

  &:disabled {
    cursor: default;
  }
  ${border}
  ${color}
  ${space}
`

const PrimaryButton = styled(BaseButton)`
  font-size: ${typography.paragraph};
  color: ${theme.primary.text};
  background-color: ${theme.primary.bg};
  border-color: ${theme.primary.hoverBorder};

  &:hover {
    color: ${theme.primary.hoverText};
    background-color: ${theme.primary.hoverBg};
    border-color: ${theme.primary.hoverBorder};
  }

  ,
  &:active {
    color: ${theme.primary.hoverText};
    background-color: ${theme.primary.hoverBg};
    border-color: ${theme.primary.hoverBorder};
  }

  ,
  &:disabled {
    color: ${theme.primary.disabledText};
    background-color: ${theme.primary.disabledBg};
    border-color: ${theme.primary.disabledBorder};
  }
`

const SecondaryButton = styled(BaseButton)`
  font-size: ${typography.paragraph};
  color: ${theme.secondary.text};
  background-color: ${theme.secondary.bg};

  &:hover {
    color: ${theme.secondary.hoverText};
    background-color: ${theme.secondary.hoverBg};
  }

  ,
  &:active {
    color: ${theme.secondary.hoverText};
    background-color: ${theme.secondary.hoverBg};
  }

  ,
  &:disabled {
    color: ${theme.secondary.disabledText};
    background-color: ${theme.secondary.disabledBg};
    border-color: ${theme.secondary.disabledBorder};
  }
`

const TertiaryButton = styled(BaseButton)`
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

  ,
  &:disabled {
    color: ${theme.secondary.disabledText};
    background-color: ${theme.secondary.disabledBg};
    border-color: ${theme.secondary.disabledBorder};
  }
`

/* BUTTON VARIANT
PrimaryButton
SecondaryButton
GhostButton
TertiaryButton
IconButton
Link */

const Button: React.FC<ButtonProps> = (props) => {
  return (
    <ThemeProvider theme={theme}>
      {props.variant === "primary" ? (
        <PrimaryButton {...props}></PrimaryButton>
      ) : props.variant === "secondary" ? (
        <SecondaryButton title="button" {...props}></SecondaryButton>
      ) : (
        <TertiaryButton title="button" {...props} />
      )}
    </ThemeProvider>
  )
}

export default Button
