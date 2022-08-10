import { css, cx } from "@emotion/css"
import React, { useRef, useState } from "react"
import { UseFormRegisterReturn } from "react-hook-form"

import { baseTheme } from "../../styles"
import { dateToString } from "../../utils/time"

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

const DateTimeLocal = ({
  onChange,
  register,
  className,
  defaultValue,
  ...rest
}: TimePickerExtraProps) => {
  const ref = useRef<HTMLInputElement>(null)

  const [value, setValue] = useState<string>(defaultValue ?? "")

  return (
    <div
      className={cx(
        css`
          margin-bottom: 1rem;

          label {
            display: grid;

            input {
              padding: 10px 12px;
              border: 2px solid #dedede;
              border-radius: 3px;
              outline: none;

              &:focus,
              &:active {
                border-color: #55b3f5;
              }

              @media (max-width: 767.98px) {
                padding: 6px 8px;
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
          ref={ref}
          type="datetime-local"
          step="1"
          {...rest}
          {...register}
          onChange={(event) => {
            onChange && onChange(event.target.value)
            register?.onChange && register.onChange(event)
            setValue(event.target.value)
          }}
          value={value}
        />
      </label>

      {value && (
        <small
          className={css`
            display: block;
            height: 18px;
          `}
        >
          {dateToString(new Date(value))}
        </small>
      )}

      {rest.error && (
        <span className={cx(error)} id={`${rest.label}_error`} role="alert">
          {rest.error}
        </span>
      )}
    </div>
  )
}

export default DateTimeLocal
