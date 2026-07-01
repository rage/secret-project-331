"use client"

import styled from "@emotion/styled"
import React, { TextareaHTMLAttributes, useEffect, useRef } from "react"

import { primaryFont } from "@/shared-module/common/styles/typography"

/**
 * A `<textarea>` that looks like the single-line shared-module `InputFields/TextField` while
 * `multiline` is false and grows to fit content while it's true. Always the same element, so
 * toggling `multiline` never drops focus or the caret. Styles mirror TextField — keep in sync.
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

const StyledTextArea = styled.textarea<{ whiteSpace: string }>`
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
  transition:
    ease-in-out,
    width 0.35s ease-in-out;
  /* Collapsed: no wrap, caret scrolls horizontally. Expanded: wraps and grows. */
  white-space: ${({ whiteSpace }) => whiteSpace};

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
  multiline: boolean
  onChangeByValue: (value: string) => void
}

const resizeToContent = (textarea: HTMLTextAreaElement | null) => {
  if (!textarea) {
    return
  }
  // Reset so the field can shrink as well as grow, then size to content.
  // eslint-disable-next-line i18next/no-literal-string
  textarea.style.height = "auto"
  // +5 covers the 2px borders under border-box (scrollHeight excludes them); without it the last
  // line clips. Matches the shared TextAreaField.
  // eslint-disable-next-line i18next/no-literal-string
  textarea.style.height = `${textarea.scrollHeight + 5}px`
}

const AutoExpandingTextField: React.FC<AutoExpandingTextFieldProps> = ({
  label,
  multiline,
  value,
  onChangeByValue,
  onKeyDown,
  ...rest
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Grow to fit content while expanded; collapsed uses rows={1} for the single-line height.
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }
    if (!multiline) {
      // Drop leftover inline height so rows={1} governs.
      textarea.style.height = ""
      return
    }
    resizeToContent(textarea)
  }, [multiline, value])

  useEffect(() => {
    // Mounted hidden (e.g. in a collapsed <details>) reports scrollHeight 0; recompute when visible.
    const textarea = textareaRef.current
    if (!multiline || !textarea) {
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
  }, [multiline])

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChangeByValue(event.target.value)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Collapsed = single-line: suppress Enter's newline, but not the Enter that commits an IME
    // composition (CJK input would lose its keystroke).
    if (!multiline && event.key === "Enter" && !event.nativeEvent.isComposing) {
      event.preventDefault()
    }
    onKeyDown?.(event)
  }

  // CSS / HTML attribute values (not user-facing text).
  // eslint-disable-next-line i18next/no-literal-string
  const whiteSpace = multiline ? "pre-wrap" : "nowrap"
  // eslint-disable-next-line i18next/no-literal-string
  const wrapMode = multiline ? "soft" : "off"

  return (
    <Wrapper>
      <label>
        <Label>{label}</Label>
        <StyledTextArea
          {...rest}
          ref={textareaRef}
          whiteSpace={whiteSpace}
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
