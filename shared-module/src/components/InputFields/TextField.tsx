import { css, cx } from "@emotion/css"
import styled from "@emotion/styled"
import React from "react"
import { FieldError, UseFormRegisterReturn } from "react-hook-form"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../../styles"
import { primaryFont } from "../../styles/typography"
import { errorToDescription } from "../../utils/strings"

interface TextFieldExtraProps {
  name?: string
  type?: "email" | "password" | "text" | "number" | "color"
  label?: string
  labelStyle?: string
  hint?: string
  error?: string | FieldError
  placeholder?: string
  required?: boolean
  value?: string | number
  onBlur?: (event: React.FocusEvent<HTMLInputElement>) => void
  onFocus?: (event: React.FocusEvent<HTMLInputElement>) => void
  onChange?: (value: string, name?: string) => void
  className?: string
  disabled?: boolean
  id?: string
  defaultValue?: string
  register?: UseFormRegisterReturn
  min?: number
  step?: string
}

const ERRORCOLOR = baseTheme.colors.red[600]
const DEFAULTCOLOR = "#dedede"

interface InputExtraProps {
  error?: string
  disabled?: boolean
  colorField?: boolean
}

// eslint-disable-next-line i18next/no-literal-string
const Input = styled.input<InputExtraProps>`
  background: #fcfcfc;
  border-width: 1.6px;
  border-style: solid;
  border-radius: 3px;
  border-color: ${({ error }) => (error ? ERRORCOLOR : DEFAULTCOLOR)};
  ${({ colorField }) => !colorField && "padding: 8px 10px 10px 10px;"}
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

// eslint-disable-next-line i18next/no-literal-string
const errorClass = css`
  color: ${baseTheme.colors.red[600]};
  font-size: 14px;
  display: inline-block;
`

export type TextFieldProps = React.HTMLAttributes<HTMLInputElement> & TextFieldExtraProps

const TextField = ({
  onChange,
  className,
  register,
  disabled,
  error,
  ...rest
}: TextFieldExtraProps) => {
  const { t } = useTranslation()
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
      <label
        aria-label={`${rest.label}${rest.required === true && ` (${t("required")})`}`}
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
          // eslint-disable-next-line i18next/no-literal-string
          aria-errormessage={`${rest.id ?? rest.label}_error`}
          aria-invalid={error !== undefined}
          onChange={({ target: { value } }) => onChange && onChange(value)}
          defaultValue={rest.defaultValue}
          error={errorToDescription(error) ?? undefined}
          {...rest}
          // Register overrides onChange if specified
          {...register}
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
}

export default TextField
