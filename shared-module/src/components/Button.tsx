import { ThemeProvider } from "@emotion/react"
import styled from "@emotion/styled"
import css from "@styled-system/css"
import React from "react"

import { fontWeights, primaryFont, theme, typography } from "../utils"

export interface ButtonExtraProps {
  variant: "primary" | "secondary"
  size: "medium" | "large"
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonExtraProps

const BaseButton = styled.button`
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

const PrimaryButton = styled(BaseButton)(
  css({
    fontSize: typography.paragraph,
    color: "black",
    backgroundColor: "tomato",

    "&:hover": {
      color: theme.primary.text,
      backgroundColor: theme.primary.bg,
    },

    "&:active": {
      color: theme.primary.hoverText,
      backgroundColor: theme.primary.hoverBg,
    },

    "&:disabled": {
      color: theme.primary.disabledText,
      backgroundColor: theme.primary.disabledBg,
      borderColor: theme.primary.disabledBorder,
    },
  }),
)

const SecondaryButton = styled(BaseButton)(
  css({
    fontSize: typography.paragraph,
    color: theme.secondary.text,
    backgroundColor: theme.secondary.bg,

    "&:hover": {
      color: theme.secondary.hoverText,
      backgroundColor: theme.secondary.hoverBg,
    },

    "&:active": {
      color: theme.secondary.activeBg,
      backgroundColor: theme.secondary.activeBg,
    },

    "&:disabled": {
      color: theme.secondary.disabledText,
      backgroundColor: theme.secondary.disabledBg,
      borderColor: theme.secondary.disabledBorder,
    },
  }),
)

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
      {props.variant === "secondary" ? (
        <PrimaryButton {...props}></PrimaryButton>
      ) : (
        <SecondaryButton title="button" {...props} />
      )}
    </ThemeProvider>
  )
}

export default Button
