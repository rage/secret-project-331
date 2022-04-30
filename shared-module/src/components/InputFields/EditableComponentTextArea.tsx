import { css, cx } from "@emotion/css"
import React, { useEffect, useRef } from "react"

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
  defaultValue?: string
  autoResize?: boolean
}

export type TextFieldProps = React.HTMLAttributes<HTMLInputElement> & TextAreaExtraProps

function updateHeight(ref: React.RefObject<HTMLTextAreaElement>) {
  if (ref.current) {
    // eslint-disable-next-line i18next/no-literal-string
    ref.current.style.height = "20px"
    // eslint-disable-next-line i18next/no-literal-string
    ref.current.style.height = `${ref.current.scrollHeight /* + 5 */}px`
  }
}

const EditableComponentTextArea = ({
  onChange,
  className,
  autoResize,
  ...rest
}: TextAreaExtraProps) => {
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
          label {
            display: grid;

            textarea {
              background: transparent;
              border: none;
              outline: none;
              resize: none;
              -webkit-box-shadow: none;
              -moz-box-shadow: none;
              box-shadow: none;
              width: 100%;
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
        <textarea
          ref={textareaRef}
          onChange={({ target: { value, name } }) => {
            onChange(value, name)
            if (autoResize) {
              updateHeight(textareaRef)
            }
          }}
          /* onKeyPress={(event) => onKeyPress(event)} */
          defaultValue={rest.defaultValue}
          {...rest}
        />
      </label>
    </div>
  )
}

export default EditableComponentTextArea
