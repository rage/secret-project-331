import { ThemeProvider } from "@emotion/react"
import styled from "@emotion/styled"
import React from "react"
import { border, color, space } from "styled-system"

import { fontWeights, primaryFont, theme, typography } from "../utils"

export interface ButtonExtraProps {
  variant: "primary" | "secondary"
  size: "medium" | "large"
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonExtraProps

const BaseButton = styled.button`
  ${space}
  ${color}
  ${border}
  position: relative;
  display: inline-block;
  padding: 18px 36px;
  font-family: ${primaryFont};
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
  border: 0;
  transition: all 150ms linear;

  &:hover {
    text-decoration: none;
  }

  &:focus {
    text-decoration: none;
  }

  &:disabled {
    cursor: default;
  }
`

const PrimaryButton = styled(BaseButton)`
  font-size: ${typography.paragraph};
  color: ${theme.primary.text};
  background-color: ${theme.primary.bg};
  border: 2px solid ${theme.primary.hoverBorder};

  &:hover {
    color: ${theme.primary.hoverText};
    background-color: ${theme.primary.hoverBg};
    border: 2px solid ${theme.primary.hoverBorder};
  }

  ,
  &:active {
    color: ${theme.primary.hoverText};
    background-color: ${theme.primary.hoverBg};
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
    color: ${theme.secondary.activeBg};
    background-color: ${theme.secondary.activeBg};
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
      ) : (
        <SecondaryButton title="button" {...props} />
      )}
    </ThemeProvider>
  )
}

export default Button
