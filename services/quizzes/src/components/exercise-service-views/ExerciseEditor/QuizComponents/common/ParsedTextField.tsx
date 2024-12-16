import styled from "@emotion/styled"
import { Eye, Pencil } from "@vectopus/atlas-icons-react"
import React, { Ref, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import ParsedText from "../../../../ParsedText"

import Button from "@/shared-module/common/components/Button"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"

const DisplayContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
`

const TextfieldContainer = styled.div`
  * {
    margin: 0px;
  }
`

const ParsedTextContainer = styled.div`
  height: 68px;
`

const StyledButton = styled(Button)`
  display: flex !important;
  align-items: center;
  border: 1px solid #dae6e5 !important;
  margin: 2px 0px 4px 0px !important;
  height: 24px;
  cursor: pointer;
  :hover {
    border: 1px solid #bcd1d0;
  }
`

interface ParsedTextFieldProps {
  label: string
  value: string | null
  onChange: (value: string) => void
}

const ParsedTextField: React.FC<ParsedTextFieldProps> = ({ label, value, onChange }) => {
  const [preview, setPreview] = useState(false)
  const [text, setText] = useState(value ?? "")
  const cursorPosition = useRef<number | null>(null)
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)

  const { t } = useTranslation()

  const containsMarkdown = useMemo(
    () => text.includes("[markdown]") && text.includes("[/markdown]"),
    [text],
  )

  const prevContainsMarkdown = useRef<boolean>(containsMarkdown)

  const containsLatex = useMemo(() => text.includes("[latex]") && text.includes("[/latex]"), [text])

  const hasTags = useMemo(
    () => containsMarkdown || containsLatex,
    [containsMarkdown, containsLatex],
  )

  /**
   * Handles focus and cursor position restoration when the `containsMarkdown` state changes.
   */
  useEffect(() => {
    if (
      (!prevContainsMarkdown.current && containsMarkdown) ||
      (prevContainsMarkdown.current && !containsMarkdown)
    ) {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.setSelectionRange(cursorPosition.current, cursorPosition.current)
      }
    }

    prevContainsMarkdown.current = containsMarkdown
  }, [containsMarkdown])

  const PreviewButton = (
    <>
      <StyledButton variant="icon" size="small" onClick={() => setPreview(!preview)}>
        {preview ? <Pencil size={16} /> : <Eye size={18} />}
      </StyledButton>
      <p> {preview ? t("edit-text") : t("preview-rendered-text")} </p>
    </>
  )

  const handleOnChange = (value: string) => {
    cursorPosition.current = inputRef.current?.selectionStart ?? null
    onChange(value)
    setText(value)
  }

  return (
    <TextfieldContainer>
      {preview ? (
        <ParsedTextContainer>
          <ParsedText text={value} parseMarkdown parseLatex inline />
        </ParsedTextContainer>
      ) : containsMarkdown ? (
        <TextAreaField
          ref={inputRef as Ref<HTMLTextAreaElement>}
          autoResize
          value={value ?? ""}
          onChangeByValue={(value) => handleOnChange(value)}
          label={label}
        />
      ) : (
        <TextField
          ref={inputRef as Ref<HTMLInputElement>}
          value={value ?? ""}
          onChangeByValue={(value) => handleOnChange(value)}
          label={label}
        />
      )}
      <DisplayContainer>{hasTags && PreviewButton}</DisplayContainer>
    </TextfieldContainer>
  )
}

export default ParsedTextField
