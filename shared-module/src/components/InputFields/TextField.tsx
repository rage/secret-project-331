import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"

import { primaryFont } from "../../styles/typography"

interface TextFieldExtraProps {
  type?: "email" | "password" | "text" | "number"
  id?: string
  label?: string
  hint?: string
  error?: boolean
  placeholder?: string
  required?: boolean
  value?: string
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void
  onChange?: (value: string, name?: string) => void
  className?: string
  disabled?: boolean
}

const ERRORCOLOR = "#F76D82"
const DEFAULTCOLOR = "#dedede"

interface InputExtraProps {
  error?: boolean
}

const Input = styled.input<InputExtraProps>`
  background: #fcfcfc;
  border-width: 1.6px;
  border-style: solid;
  border-radius: 3px;
  border-color: ${({ error }) => (error ? ERRORCOLOR : DEFAULTCOLOR)};
  padding: 4px 12px;
  transition: ease-in-out, width 0.35s ease-in-out;
  outline: none;
  min-width: 280px;
  width: 100%;
  display: block;

  &:focus,
  &:active {
    border-color: #55b3f5;
  }
`
const label = css`
  color: #333;
  font-family: ${primaryFont};
  font-weight: 500;
  font-size: 14px;
  display: inline-block;
  margin-bottom: 2px;
`

const error = css`
  color: #f76d82;
  font-size: 14px;
  display: inline-block;
  margin-top: -15px;
`

// Error string might change in the future

const ERROR = "Error"

export type TextFieldProps = React.HTMLAttributes<HTMLInputElement> & TextFieldExtraProps

const TextField = ({ onChange, className, id, ...rest }: TextFieldExtraProps) => {
  const input = (
    <>
      <Input
        id={id}
        aria-describedby={`${rest.label}_error`}
        onChange={({ target: { value } }) => onChange && onChange(value)}
        {...rest}
      />
      <span
        className={css`
          ${cx(error)}
          display: ${rest.error === undefined ? "none" : "inline-block"};
        `}
        id={`${rest.label}_error`}
        role="alert"
      >
        {ERROR}
      </span>
    </>
  )

  if (rest.label) {
    // label in component
    return (
      <span className={className}>
        <label className={cx(label)}>
          {rest.label}
          {input}
        </label>
      </span>
    )
  } else {
    // label outside component
    return <span className={className}>{input}</span>
  }
}

export default TextField
