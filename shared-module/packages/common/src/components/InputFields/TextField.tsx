"use client"

import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import React, { forwardRef, InputHTMLAttributes } from "react"
import { FieldError } from "react-hook-form"

import { baseTheme } from "../../styles"
import { primaryFont } from "../../styles/typography"
import { errorToDescription } from "../../utils/strings"

const ERRORCOLOR = baseTheme.colors.red[600]
// gray[400]: border contrast >= 3:1 against the field background (WCAG 1.4.11).
// Focus state uses blue[600] (#215887): >= 3:1 against both the border and the field background.
const DEFAULTCOLOR = baseTheme.colors.gray[400]

interface InputExtraProps {
  error?: string
  disabled?: boolean
  colorField?: boolean
}

const Input = styled.input<InputExtraProps>`
  background: #fcfcfc;
  border-width: 2px;
  border-style: solid;
  border-radius: 3px;
  border-color: ${({ error }) => (error ? ERRORCOLOR : DEFAULTCOLOR)};
  ${({ colorField }) => !colorField && "padding: 8px 10px 10px 10px;"}
  transition: ease-in-out, width 0.35s ease-in-out;
  outline: none;
  min-width: 20px;
  width: 100%;
  display: block;
  font-size: 16px;

  ${({ disabled }) => disabled && `cursor: not-allowed;`}

  &:focus,
  &:active {
    border-color: #215887;
    box-shadow: 0 0 0 2px #215887;
  }

  @media (max-width: 767.98px) {
    padding: 6px 8px;
  }
`

const errorClass = css`
  color: ${baseTheme.colors.red[600]};
  font-size: 14px;
  display: inline-block;
`

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  type?: "email" | "password" | "text" | "number" | "color"
  label?: string
  labelStyle?: string
  hint?: string
  error?: string | FieldError
  onChangeByValue?: (value: string, name?: string) => void
}

const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  ({ onChange, onChangeByValue, className, disabled, error, ...rest }: TextFieldProps, ref) => {
    const handleOnChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      if (onChangeByValue) {
        const {
          target: { value },
        } = event
        onChangeByValue(value)
      }
      if (onChange) {
        onChange(event)
      }
    }

    return (
      <div
        className={cx(
          css`
            margin-bottom: 1rem;
            ${
              disabled &&
              `cursor: not-allowed;
            filter: opacity(0.5);`
            }
          `,
          className,
        )}
      >
        <label
          className={cx(
            css`
              color: #333;
              font-family: ${primaryFont};
              font-weight: 500;
              font-size: 14px;
              display: block;
              margin-bottom: 2px;
              ${disabled && `color: ${baseTheme.colors.gray[400]};`}
              ${disabled && `cursor: not-allowed;`}
            `,
            rest.labelStyle,
          )}
        >
          {rest.label && (
            <>
              {rest.label} {rest.required === true && ` *`}
            </>
          )}
          <Input
            id={rest.id}
            name={rest.name}
            disabled={disabled}
            colorField={rest.type === "color"}
            aria-errormessage={`${rest.id ?? rest.label}_error`}
            aria-invalid={error !== undefined}
            onChange={handleOnChange}
            defaultValue={rest.defaultValue}
            error={errorToDescription(error) ?? undefined}
            ref={ref}
            {...rest}
          />
        </label>

        <span
          className={
            error
              ? cx(errorClass)
              : css`
                  visibility: hidden;
                `
          }
          id={`${rest.id ?? rest.label}_error`}
          role="alert"
        >
          {errorToDescription(error)}
        </span>
      </div>
    )
  },
)

TextField.displayName = "TextField"
export default TextField
