import { css, cx } from "@emotion/css"
import React from "react"

interface TextAreaExtraProps {
  label?: string
  name?: string
  errorMessage?: string
  placeholder?: string
  required?: boolean
  value?: string
  disabled?: boolean
  maxlength?: string
  onChange: (value: string, name?: string) => void
  className?: string
}

export type TextFieldProps = React.HTMLAttributes<HTMLInputElement> & TextAreaExtraProps

const TextArea = ({ onChange, className, ...rest }: TextAreaExtraProps) => {
  return (
    <div
      className={cx(
        css`
          margin-bottom: 1rem;

          label {
            display: grid;

            textarea {
              background: #fcfcfc;
              border: 1.6px solid #dedede;
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
        <textarea
          onChange={({ target: { value, name } }) => onChange(value, name)}
          /* onKeyPress={(event) => onKeyPress(event)} */
          {...rest}
        />
      </label>
    </div>
  )
}

export default TextArea
