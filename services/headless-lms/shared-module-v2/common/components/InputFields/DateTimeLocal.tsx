import { css, cx } from "@emotion/css"
import React, { forwardRef, InputHTMLAttributes, useState } from "react"

import { baseTheme } from "../../styles"
import { dateToString } from "../../utils/time"

const error = css`
  color: #f76d82;
  font-size: 14px;
  display: inline-block;
  margin-top: -15px;
`

export interface TimePickerProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  onChangeByValue?: (value: string, name?: string) => void
  error?: string
  defaultValue?: string
  className?: string
}

const DateTimeLocal: React.FC<TimePickerProps> = forwardRef<HTMLInputElement, TimePickerProps>(
  ({ onChangeByValue, onChange, className, defaultValue, ...rest }, ref) => {
    const [value, setValue] = useState<string>(defaultValue ?? "")
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
      setValue(event.target.value)
    }
    return (
      <div
        className={cx(
          css`
            margin-bottom: 1rem;

            label {
              display: grid;

              input {
                padding: 8px 10px 10px 10px;
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
              color: ${baseTheme.colors.gray[500]};
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
            onChange={handleOnChange}
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
  },
)
DateTimeLocal.displayName = "DateTimeLocal"

export default DateTimeLocal
