import { css } from "@emotion/css"
import { ThemeProvider } from "@emotion/react"
import styled from "@emotion/styled"
import React from "react"

import { fontWeights, primaryFont, theme, typography } from "../utils"

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
  font-size: 14px;
  letter-spacing: 0.02em;
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

const StyledButton = styled.button`
  margin: 0;
  display: inline-block;
  color : ${theme.primaryColor};
  cursor: pointer;
  width: auto;
  max-width: 100%;
  padding: 1rem;
  background-color: ${theme.primaryActiveColor};
  border: 1px solid black;
  text-decoration: none;
  font-size: ${typography.paragraph}
  font-family: ${primaryFont}

  &:hover {
    color: ${theme.textColorInvented};
    background-color: ${theme.textColorInvented};
  }

  &:active {
    color: ${theme.textColorInvented};
    background-color: ${theme.textColorInvented};
  }
`

/* BUTTON VARIANT
PrimaryButton
SecondaryButton
TertiaryButton
IconButton
Link */

const Button: React.FC<ButtonProps> = (props) => {
  if (props.variant === "secondary") {
    return <StyledButton {...props}></StyledButton>
  }
  return (
    <ThemeProvider theme={theme}>
      <button
        title="button"
        className={css`
          padding: 1rem;
          background-color: white;
          border: 1px solid black;
          font-family: ${primaryFont};
        `}
        {...props}
      />
    </ThemeProvider>
  )
}

export default Button
