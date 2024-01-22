import { css, cx } from "@emotion/css"
import React, { InputHTMLAttributes } from "react"

export interface TimePickerProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  onChangeByValue: (value: string, name?: string) => void
}

const TimePicker = ({ onChangeByValue, onChange, className, ...rest }: TimePickerProps) => {
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

          label {
            display: grid;

            input {
              max-width: 18.5ch;
              padding: 8px 10px 10px 10px;
              background: #fcfcfc;
              border: 1.6px solid #dedede;
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
        `,
        className,
      )}
    >
      <label>
        <span>{rest.label}</span>
        <input type="time" onChange={handleOnChange} {...rest} />
      </label>
    </div>
  )
}

export default TimePicker
