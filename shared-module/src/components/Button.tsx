import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { ThemeProvider } from '@emotion/react'
import {
  theme,
  typography,
  primaryFont,
} from "../utils";

export interface ButtonExtraProps {
  variant: "primary" | "secondary"
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonExtraProps

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

const Button: React.FC<ButtonProps> = (props) => {
  if (props.variant === "secondary") {
    return <StyledButton {...props}></StyledButton>
  }
  return (
    <ThemeProvider theme={theme}>
    <button
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
