import { css, cx } from "@emotion/css"
import React, { forwardRef, TextareaHTMLAttributes, useEffect, useRef } from "react"
import { FieldError } from "react-hook-form"

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  errorMessage?: string
  error?: string | FieldError
  onChangeByValue?: (value: string, name?: string) => void
  autoResize?: boolean
  largeTextarea?: boolean
}

function updateHeight(ref: React.RefObject<HTMLTextAreaElement>) {
  if (ref.current) {
    // eslint-disable-next-line i18next/no-literal-string
    ref.current.style.height = "auto"
    // eslint-disable-next-line i18next/no-literal-string
    ref.current.style.height = `${ref.current.scrollHeight + 5}px`
  }
}

const useCombinedRefs = (
  fwdRef: React.ForwardedRef<HTMLTextAreaElement>,
  innerRef: React.MutableRefObject<HTMLTextAreaElement | null>,
) => {
  React.useEffect(() => {
    ;[innerRef, fwdRef].forEach((ref) => {
      if (ref) {
        if (typeof ref === "function") {
          ref(innerRef.current || null)
        } else {
          ref.current = innerRef.current || null
        }
      }
    })
  }, [innerRef, fwdRef])
  return innerRef
}
const TextAreaField = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  (
    { onChangeByValue, onChange, className, autoResize, largeTextarea, ...rest }: TextAreaProps,
    ref,
  ) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const combinedRef = useCombinedRefs(ref, textareaRef)

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
    useEffect(() => {
      // This auto-resizes the textarea if the feature is enabled
      if (!autoResize || !textareaRef.current) {
        return
      }
      updateHeight(textareaRef)
    }, [ref, rest.value, autoResize])
    return (
      <div
        className={cx(
          css`
            margin-bottom: 1rem;

            label {
              display: grid;
              ${largeTextarea ? "height: 100%;" : null};

              textarea {
                background: #fcfcfc;
                border: 1.6px solid #dedede;
                padding: 10px 12px;
                ${largeTextarea ? "height: 150px;" : null};
              }
              span {
                color: #333;
                font-size: 14px;
                font-weight: 500;
                margin-bottom: 0.2rem;
                ${largeTextarea ? "height: 25px;" : null};
              }
            }
          `,
          className,
        )}
      >
        <label>
          <span>{rest.label}</span>
          <textarea
            ref={combinedRef}
            onChange={handleOnChange}
            /* onKeyPress={(event) => onKeyPress(event)} */
            defaultValue={rest.defaultValue}
            {...rest}
          />
        </label>
      </div>
    )
  },
)

TextAreaField.displayName = "TextAreaField"
export default TextAreaField
