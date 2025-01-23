import { css, cx } from "@emotion/css"
import React, { forwardRef, InputHTMLAttributes } from "react"

import { baseTheme } from "../../styles"
import { dateToString } from "../../utils/time"

const errorStyle = css`
  color: #f76d82;
  font-size: 14px;
  display: inline-block;
  margin-top: -15px;
`

const warningStyle = css`
  color: #b3440d;
  font-size: 14px;
  display: inline-block;
  margin-top: -15px;
`

export interface TimePickerProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  onChangeByValue?: (value: string, name?: string) => void
  error?: string
  warning?: string
  className?: string
}

const DateTimeLocal = forwardRef<HTMLInputElement, TimePickerProps>(
  (props: TimePickerProps, ref) => {
    const { onChangeByValue, onChange, className, defaultValue, value, warning, error, ...rest } =
      props

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

    const effectiveValue = value ?? defaultValue

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
            onChange={handleOnChange}
            value={value}
            defaultValue={defaultValue}
            aria-label={rest.label}
            aria-invalid={!!error}
            {...rest}
          />
        </label>

        {effectiveValue && typeof effectiveValue === "string" && (
          <small
            className={css`
              display: block;
              height: 18px;
            `}
          >
            {dateToString(effectiveValue)}
          </small>
        )}

        {error && (
          <span className={cx(errorStyle)} id={`${rest.label}_error`} role="alert">
            {error}
          </span>
        )}

        {warning && !error && (
          <span className={cx(warningStyle)} id={`${rest.label}_warning`} role="alert">
            {warning}
          </span>
        )}
      </div>
    )
  },
)
DateTimeLocal.displayName = "DateTimeLocal"

export default DateTimeLocal
