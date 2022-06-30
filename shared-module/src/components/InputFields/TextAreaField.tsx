import { css, cx } from "@emotion/css"
import React, { useEffect, useRef } from "react"
import { UseFormRegisterReturn } from "react-hook-form"

interface TextAreaExtraProps {
  label?: string
  name?: string
  errorMessage?: string
  placeholder?: string
  required?: boolean
  value?: string
  disabled?: boolean
  maxlength?: string
  onChange?: (value: string, name?: string) => void
  className?: string
  defaultValue?: string
  autoResize?: boolean
  register?: UseFormRegisterReturn
}

type TextAreaProps = Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "onChange"> &
  TextAreaExtraProps

function updateHeight(ref: React.RefObject<HTMLTextAreaElement>) {
  if (ref.current) {
    // eslint-disable-next-line i18next/no-literal-string
    ref.current.style.height = "auto"
    // eslint-disable-next-line i18next/no-literal-string
    ref.current.style.height = `${ref.current.scrollHeight + 5}px`
  }
}

const TextArea = ({ onChange, className, autoResize, register, ...rest }: TextAreaProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // This auto-resizes the textarea if the feature is enabled
    if (!autoResize || !textareaRef.current) {
      return
    }
    updateHeight(textareaRef)
  }, [rest.value, autoResize])
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
              padding: 10px 12px;
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
          ref={textareaRef}
          onChange={({ target: { value, name } }) => {
            if (onChange) {
              onChange(value, name)
            }

            if (autoResize) {
              updateHeight(textareaRef)
            }
          }}
          {...register}
          /* onKeyPress={(event) => onKeyPress(event)} */
          defaultValue={rest.defaultValue}
          {...rest}
        />
      </label>
    </div>
  )
}

export default TextArea
