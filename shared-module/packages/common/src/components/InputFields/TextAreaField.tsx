import { css, cx } from "@emotion/css"
import React, { forwardRef, TextareaHTMLAttributes, useEffect, useRef } from "react"
import { FieldError } from "react-hook-form"

export interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  errorMessage?: string
  error?: string | FieldError
  onChangeByValue?: (value: string, name?: string) => void
  autoResize?: boolean
  onAutoResized?: () => void
  autoResizeMaxHeightPx?: number
  resize?: "none" | "both" | "horizontal" | "vertical" | "block" | "inline"
}

function updateHeight(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  onAutoResized?: () => void,
  maxHeightPx?: number,
) {
  if (ref.current) {
    const currentHeight = ref.current.style.height
    // set the height as auto to set the height based on content length
    // eslint-disable-next-line i18next/no-literal-string
    ref.current.style.height = "auto"
    const contentHeight = ref.current.style.height
    // if changes, then call the scrolltobotton
    // doesn't work yet

    if (maxHeightPx && ref.current.scrollHeight > maxHeightPx) {
      // eslint-disable-next-line i18next/no-literal-string
      ref.current.style.height = `${maxHeightPx}px`
    } else {
      // eslint-disable-next-line i18next/no-literal-string
      ref.current.style.height = `${ref.current.scrollHeight + 5}px`
    }
    if (currentHeight != contentHeight && onAutoResized) {
      onAutoResized()
    }
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
    {
      onChangeByValue,
      onChange,
      className,
      autoResize,
      resize = "vertical",
      onAutoResized,
      autoResizeMaxHeightPx,
      ...rest
    }: TextAreaProps,
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
        updateHeight(textareaRef, onAutoResized, autoResizeMaxHeightPx)
      }
    }

    useEffect(() => {
      if (!autoResize) {
        return
      }
      updateHeight(textareaRef, onAutoResized, autoResizeMaxHeightPx)
    }, [autoResize, onAutoResized, autoResizeMaxHeightPx])

    useEffect(() => {
      // When a peer review editor is rendered in an exercise, this component is rendered in a hidden state. Thus, the element scrollHeight is 0. We use an intersection observer to detect when the element is visible and then update the height.
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && textareaRef.current) {
            updateHeight(textareaRef, onAutoResized, autoResizeMaxHeightPx)
            break
          }
        }
      })

      const currentTextareaRef = textareaRef.current

      if (currentTextareaRef) {
        observer.observe(currentTextareaRef)
      }

      return () => {
        if (currentTextareaRef) {
          observer.disconnect()
        }
      }
    }, [onAutoResized, autoResizeMaxHeightPx])

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
                resize: ${resize};
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
            ref={combinedRef}
            onChange={handleOnChange}
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
