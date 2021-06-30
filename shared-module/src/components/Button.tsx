import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

export interface ButtonExtraProps {
  variant: "primary" | "secondary"
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonExtraProps

const StyledButton = styled.button`
  padding: 1rem;
  background-color: rebeccapurple;
  border: 1px solid black;
`

const Button: React.FC<ButtonProps> = (props) => {
  if (props.variant === "secondary") {
    return <StyledButton {...props} />
  }
  return (
    <button
      className={css`
        padding: 1rem;
        background-color: white;
        border: 1px solid black;
      `}
      {...props}
    />
  )
}

export default Button
