import { ThemeProvider } from "@emotion/react"
import styled from "@emotion/styled"
import css from "@styled-system/css"
import React from "react"
import { color } from "styled-system"

import { button, fontWeights, primaryFont, theme, typography } from "../utils"

export interface ButtonExtraProps {
  variant: "primary" | "secondary"
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
      color: theme.textColorInvented,
      backgroundColor: theme.textColorInvented,
    },

    "&:active": {
      color: theme.textColorInvented,
      backgroundColor: theme.textColorInvented,
    },

    "&:disabled": {
      color: theme.textColorInvented,
      backgroundColor: theme.textColorInvented,
      borderColor: theme.textColorInvented,
    },
  }),
)

const SecondaryButton = styled(BaseButton)`
  color : ${button.secondary.text};
  background-color: ${button.primary.bg};
  font-size: ${typography.paragraph}

  &:hover {
    color: ${theme.textColorInvented};
    background-color: ${theme.textColorInvented};
  }

  &:active {
    color: ${theme.textColorInvented};
    background-color: ${theme.textColorInvented};
  }

  &:disabled {
    color: ${theme.textColorInvented};
    background-color: ${theme.textColorInvented};
    border-color: ${theme.textColorInvented};
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
  if (props.variant === "secondary") {
    return <PrimaryButton {...props}></PrimaryButton>
  }
  return (
    <ThemeProvider theme={theme}>
      <SecondaryButton title="button" {...props} />
    </ThemeProvider>
  )
}

export default Button
