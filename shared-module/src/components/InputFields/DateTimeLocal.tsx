import { css, cx } from "@emotion/css"
import React from "react"
import { UseFormRegisterReturn } from "react-hook-form"

import { baseTheme } from "../../styles"

interface TimePickerExtraProps {
  label: string
  placeholder?: string
  value?: string
  max?: string
  min?: string
  readOnly?: boolean
  onChange?: (value: string, name?: string) => void
  error?: string
  register?: UseFormRegisterReturn
  defaultValue?: string
  className?: string
}

const error = css`
  color: #f76d82;
  font-size: 14px;
  display: inline-block;
  margin-top: -15px;
`

export type TimePickerProps = React.HTMLAttributes<HTMLInputElement> & TimePickerExtraProps

const DateTimeLocal = ({ onChange, register, className, ...rest }: TimePickerExtraProps) => {
  return (
    <div
      className={cx(
        css`
          margin-bottom: 1rem;

          label {
            display: grid;

            input {
              padding: 4px 0;
              border: 2px solid #dedede;
              border-radius: 3px;
              outline: none;

              &:focus,
              &:active {
                border-color: #55b3f5;
              }
            }

            span {
              color: #333;
              font-size: 14px;
              font-weight: 500;
              margin-bottom: 0.2rem;
            }
          }

          small {
            color: ${baseTheme.colors.grey[500]};
            font-size: 12px;
            text-align: left;
            width: 100%;
            display: block;
            padding-left: 5px;
          }
        `,
        className,
      )}
    >
      <label>
        <span>{rest.label}</span>
        <input
          type="datetime-local"
          onChange={({ target: { value } }) => {
            onChange && onChange(value)
          }}
          {...rest}
          {...register}
        />
      </label>
      <small>{rest.value}</small>
      {rest.error && (
        <span className={cx(error)} id={`${rest.label}_error`} role="alert">
          {rest.error}
        </span>
      )}
    </div>
  )
}

export default DateTimeLocal
