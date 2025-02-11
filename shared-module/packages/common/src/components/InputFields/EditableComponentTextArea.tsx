import { css, cx } from "@emotion/css"
import React, { TextareaHTMLAttributes, useEffect, useRef } from "react"

export interface TextFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  errorMessage?: string
  autoResize?: boolean
  onChangeByValue: (value: string, name?: string) => void
}

function updateHeight(ref: React.RefObject<HTMLTextAreaElement | null>) {
  if (ref.current) {
    ref.current.style.height = "20px"
    // eslint-disable-next-line i18next/no-literal-string
    ref.current.style.height = `${ref.current.scrollHeight /* + 5 */}px`
  }
}

const EditableComponentTextArea = ({
  onChangeByValue,
  onChange,
  className,
  autoResize,
  ...rest
}: TextFieldProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    // This auto-resizes the textarea if the feature is enabled
    if (!autoResize || !textareaRef.current) {
      return
    }
    updateHeight(textareaRef)
  }, [rest.value, autoResize])

  const handleOnChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (onChangeByValue) {
      const {
        target: { value },
      } = event
      onChangeByValue(value)
    }
    if (onChange) {
      onChange(event)
    }
    if (autoResize) {
      updateHeight(textareaRef)
    }
  }
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
          onChange={handleOnChange}
          /* onKeyPress={(event) => onKeyPress(event)} */
          defaultValue={rest.defaultValue}
          {...rest}
        />
      </label>
    </div>
  )
}

export default EditableComponentTextArea
