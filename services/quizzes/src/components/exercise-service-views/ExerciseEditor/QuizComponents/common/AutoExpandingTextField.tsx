"use client"

import styled from "@emotion/styled"
import React, { TextareaHTMLAttributes, useEffect, useRef } from "react"

import { primaryFont } from "@/shared-module/common/styles/typography"

/**
 * A text field that is always a `<textarea>` but is visually and functionally
 * indistinguishable from the standard single-line `<input>` (shared-module
 * `InputFields/TextField`) while `multiline` is false, and grows to fit its content like a
 * normal textarea while `multiline` is true.
 *
 * It is always the same element, so toggling `multiline` never swaps the DOM node and never
 * drops focus or the caret — the reason we don't switch between `<input>` and `<textarea>`.
 *
 * The visual styles below mirror `shared-module/.../InputFields/TextField.tsx`. Keep them in
 * sync: if TextField's border/padding/radius/focus styling changes, update this too.
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
  /* Collapsed behaves like a single-line input (no wrapping, caret scrolls horizontally);
     expanded wraps and grows. Height is driven by rows={1} when collapsed and by the
     auto-resize effect when expanded. */
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
  // Reset first so the field can shrink as well as grow, then size to the content.
  // eslint-disable-next-line i18next/no-literal-string
  textarea.style.height = "auto"
  // scrollHeight is content + padding only; under the global box-sizing: border-box the
  // element height also has to cover the 2px top/bottom borders, so add a small allowance.
  // Without it the bottom of the last line is clipped (overflow is hidden). Matches the +5
  // used by the shared TextAreaField.
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

  // Grow to fit content only while expanded. While collapsed, rows={1} plus the shared box
  // model give the exact height of the standard single-line input.
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) {
      return
    }
    if (!multiline) {
      // Drop any inline height left over from a previous expanded state so rows={1} governs.
      textarea.style.height = ""
      return
    }
    resizeToContent(textarea)
  }, [multiline, value])

  useEffect(() => {
    // The field can mount hidden (e.g. inside a collapsed <details>), where scrollHeight is 0.
    // Recompute once it becomes visible so an expanded field is sized correctly.
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
    // While collapsed, behave like a single-line input: Enter must not insert a newline.
    // Never intercept the Enter that confirms an in-progress IME composition (a native input
    // doesn't), or CJK/etc. input would lose its commit keystroke.
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
