import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { UseFormRegisterReturn } from "react-hook-form"

import { baseTheme } from "../../styles"
import { primaryFont } from "../../styles/typography"

interface TextFieldExtraProps {
  name?: string
  type?: "email" | "password" | "text" | "number"
  label?: string
  labelStyle?: string
  hint?: string
  error?: string
  placeholder?: string
  required?: boolean
  value?: string
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void
  onChange?: (value: string, name?: string) => void
  className?: string
  disabled?: boolean
  id?: string
  defaultValue?: string
  register?: UseFormRegisterReturn
}

const ERRORCOLOR = "#F76D82"
const DEFAULTCOLOR = "#dedede"

interface InputExtraProps {
  error?: string
  disabled?: boolean
}

// eslint-disable-next-line i18next/no-literal-string
const Input = styled.input<InputExtraProps>`
  background: #fcfcfc;
  border-width: 1.6px;
  border-style: solid;
  border-radius: 3px;
  border-color: ${({ error }) => (error ? ERRORCOLOR : DEFAULTCOLOR)};
  padding: 8px 10px 10px 10px;
  transition: ease-in-out, width 0.35s ease-in-out;
  outline: none;
  min-width: 20px;
  width: 100%;
  display: block;
  font-size: 17px;

  ${({ disabled }) => disabled && `cursor: not-allowed;`}

  &:focus,
  &:active {
    border-color: #55b3f5;
  }

  @media (max-width: 767.98px) {
    padding: 6px 8px;
  }
`

const error = css`
  color: #f76d82;
  font-size: 14px;
  display: inline-block;
  margin-top: -15px;
`

export type TextFieldProps = React.HTMLAttributes<HTMLInputElement> & TextFieldExtraProps

const TextField = ({ onChange, className, register, disabled, ...rest }: TextFieldExtraProps) => {
  return (
    <div
      className={cx(
        css`
          margin-bottom: 1rem;
          ${disabled &&
          `cursor: not-allowed;
            filter: opacity(0.5);`}
        `,
        className,
      )}
    >
      <label>
        {rest.label && (
          <div
            className={cx(
              css`
                color: #333;
                font-family: ${primaryFont};
                font-weight: 500;
                font-size: 14px;
                display: inline-block;
                margin-bottom: 2px;
                ${disabled && `color: ${baseTheme.colors.grey[400]};`}
                ${disabled && `cursor: not-allowed;`}
              `,
              rest.labelStyle,
            )}
          >
            {rest.label}
          </div>
        )}
        <Input
          id={rest.id}
          name={rest.name}
          disabled={disabled}
          // eslint-disable-next-line i18next/no-literal-string
          aria-errormessage={`${rest.label}_error`}
          aria-invalid={rest.error !== undefined}
          onChange={({ target: { value } }) => onChange && onChange(value)}
          defaultValue={rest.defaultValue}
          {...rest}
          // Register overrides onChange if specified
          {...register}
        />
      </label>
      <span
        className={
          rest.error
            ? cx(error)
            : css`
                visibility: hidden;
              `
        }
        id={`${rest.label}_error`}
        role="alert"
      >
        {rest.error}
      </span>
    </div>
  )
}

export default TextField
