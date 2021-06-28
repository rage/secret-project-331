import { css } from "@emotion/css"
import React from "react"

export interface ButtonExtraProps {
  variant: "primary" | "secondary"
}

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & ButtonExtraProps

const Button: React.FC<ButtonProps> = (props) => {
  if (props.variant === "secondary") {
    return (
      <button
        className={css`
          padding: 1rem;
          background-color: rebeccapurple;
          border: 1px solid black;
        `}
        {...props}
      />
    )
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
