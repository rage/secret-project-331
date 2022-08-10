import { css, cx } from "@emotion/css"
import React from "react"

interface DatePickerExtraProps {
  label: string
  hint?: string
  placeholder?: string
  value?: string
  max?: string
  min?: string
  /*   onBlur?: (name?:string) => void */
  onChange: (value: string, name?: string) => void
  className?: string
}

export type DatePickerProps = React.HTMLAttributes<HTMLInputElement> & DatePickerExtraProps

const DatePicker = ({ onChange, className, ...rest }: DatePickerExtraProps) => {
  return (
    <div
      className={cx(
        css`
          margin-bottom: 1rem;

          label {
            display: grid;

            input {
              max-width: 22ch;
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
        `,
        className,
      )}
    >
      <label>
        <span>{rest.label}</span>
        <input type="date" onChange={({ target: { value } }) => onChange(value)} {...rest} />
      </label>
    </div>
  )
}

export default DatePicker
