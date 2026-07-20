import styled from "@emotion/styled"
import type { TextareaHTMLAttributes } from "react"
import React, { useEffect, useRef } from "react"

import { primaryFont } from "@/shared-module/common/styles/typography"

/**
 * A `<textarea>` styled like the single-line shared-module `InputFields/TextField` that wraps long
 * text and grows in height to fit its content, so a long value is never hidden behind a horizontal
 * scroll. When `allowNewlines` is false the field is still a single logical line — Enter is
 * suppressed and the caller collapses pasted newlines — so the value never contains a line break
 * even though it may wrap across several visual rows. Styles mirror TextField — keep in sync.
 */

const Wrapper = styled.div`
  label {
    display: block;
  }
`

const Label = styled.span`
  color: #333;
  font-family: ${primaryFont};
  font-weight: 500;
  font-size: 14px;
  display: block;
  margin-bottom: 2px;
`

const StyledTextArea = styled.textarea`
  background: #fcfcfc;
  border: 2px solid #dedede;
  border-radius: 3px;
  padding: 8px 10px 10px 10px;
  font-size: 16px;
  width: 100%;
  display: block;
  outline: none;
  min-width: 20px;
  resize: none;
  overflow: hidden;
  /* Wrap long lines and break unbreakable tokens, then grow in height, instead of scrolling. */
  white-space: pre-wrap;
  overflow-wrap: break-word;

  &:focus,
  &:active {
    border-color: #55b3f5;
  }

  @media (max-width: 767.98px) {
    padding: 6px 8px;
  }
`

export interface AutoExpandingTextFieldProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "onChange"
> {
  label: string
  /**
   * Whether Enter inserts a newline. When false the field stays a single logical line (Enter is
   * suppressed); it still wraps and grows visually. Pasted newlines must be collapsed by the caller.
   */
  allowNewlines: boolean
  onChangeByValue: (value: string) => void
}

const resizeToContent = (textarea: HTMLTextAreaElement | null) => {
  if (!textarea) {
    return
  }
  // Reset so the field can shrink as well as grow, then size to content.
  // oxlint-disable-next-line i18next/no-literal-string
  textarea.style.height = "auto"
  // +5 covers the 2px borders under border-box (scrollHeight excludes them); without it the last
  // line clips. Matches the shared TextAreaField.
  // oxlint-disable-next-line i18next/no-literal-string
  textarea.style.height = `${textarea.scrollHeight + 5}px`
}

const AutoExpandingTextField: React.FC<AutoExpandingTextFieldProps> = ({
  label,
  allowNewlines,
  value,
  onChangeByValue,
  onKeyDown,
  ...rest
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Grow to fit content on every value change; rows={1} keeps a single line as the minimum height.
  useEffect(() => {
    resizeToContent(textareaRef.current)
  }, [value])

  useEffect(() => {
    // Mounted hidden (e.g. in a collapsed <details>) reports scrollHeight 0; recompute when visible.
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          resizeToContent(textarea)
          break
        }
      }
    })
    observer.observe(textarea)
    return () => observer.disconnect()
  }, [])

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChangeByValue(event.target.value)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Single logical line: suppress Enter's newline, but not the Enter that commits an IME
    // composition (CJK input would lose its keystroke).
    if (!allowNewlines && event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault()
    }
    onKeyDown?.(event)
  }

  // HTML attribute value (not user-facing text): soft wrapping so long text flows onto new rows.
  // oxlint-disable-next-line i18next/no-literal-string
  const wrapMode = "soft"

  return (
    <Wrapper>
      <label>
        <Label>{label}</Label>
        <StyledTextArea
          {...rest}
          ref={textareaRef}
          rows={1}
          wrap={wrapMode}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
        />
      </label>
    </Wrapper>
  )
}

export default AutoExpandingTextField
