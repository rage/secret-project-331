import styled from "@emotion/styled"
import React from "react"
import { border, color, space } from "styled-system"

import { baseTheme, fontWeights, headingFont, theme, typography } from "../styles"

export interface ButtonExtraProps {
  variant: "primary" | "secondary" | "tertiary"
  size: "medium" | "large"
  transform?: "normal" | "uppercase"
  children: React.ReactNode
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonExtraProps

// eslint-disable-next-line i18next/no-literal-string
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
  text-transform: ${({ transform }: ButtonProps) =>
    // eslint-disable-next-line i18next/no-literal-string
    transform == "normal" ? "capitalize" : "uppercase"};
  font-size: ${({ transform }: ButtonProps) => (transform == "normal" ? "18px" : "14px")};
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
  ${border}
  ${color}
  ${space}
`

// eslint-disable-next-line i18next/no-literal-string
const PrimaryButton = styled(BaseButton)`
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

// eslint-disable-next-line i18next/no-literal-string
const SecondaryButton = styled(BaseButton)`
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

// eslint-disable-next-line i18next/no-literal-string
const TertiaryButton = styled(BaseButton)`
  font-size: ${typography.paragraph};
  color: ${theme.secondary.text};
  background-color: ${baseTheme.colors.green[200]};

  &:hover {
    color: ${baseTheme.colors.grey[800]};
    background-color: ${baseTheme.colors.green[300]};
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

/* BUTTON VARIANT
PrimaryButton
SecondaryButton
GhostButton
TertiaryButton
IconButton
Link */

const Button: React.FC<ButtonProps> = (props) => {
  return (
    <>
      {props.variant === "primary" ? (
        <PrimaryButton {...props}></PrimaryButton>
      ) : props.variant === "secondary" ? (
        <SecondaryButton {...props}></SecondaryButton>
      ) : (
        <TertiaryButton {...props} />
      )}
    </>
  )
}

export default Button
