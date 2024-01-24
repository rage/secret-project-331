import { css, cx } from "@emotion/css"
import { InputHTMLAttributes } from "react"

export interface DatePickerProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  onChangeByValue: (value: string, name?: string) => void
}

const DatePicker = ({ onChange, onChangeByValue, className, ...rest }: DatePickerProps) => {
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
              max-width: 22ch;
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
        `,
        className,
      )}
    >
      <label>
        <span>{rest.label}</span>
        <input type="date" onChange={handleOnChange} {...rest} />
      </label>
    </div>
  )
}

export default DatePicker
