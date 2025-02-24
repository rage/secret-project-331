import styled from "@emotion/styled"
import { Eye, InfoCircle, Pencil } from "@vectopus/atlas-icons-react"
import React, { Ref, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import ParsedText from "../../../../ParsedText"

import MessagePortContext from "@/contexts/MessagePortContext"
import Button from "@/shared-module/common/components/Button"
import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import { OpenLinkMessage } from "@/shared-module/common/exercise-service-protocol-types"

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

const TextfieldWrapper = styled.div`
  display: flex;
  flex-direction: row;
  gap: 7px;
  align-items: center;
`

const Grow = styled.div`
  flex-grow: 1;
`

const InfoLink = styled.a`
  position: relative;
  top: 13px;
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
  const messagePort = useContext(MessagePortContext)

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
      <TextfieldWrapper>
        <Grow>
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
        </Grow>
        <InfoLink
          href="https://github.com/rage/secret-project-331/wiki/Add-new-exercise#formatting-feedback-messages"
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => {
            if (messagePort) {
              const target = e.target as HTMLAnchorElement
              messagePort.postMessage({
                message: "open-link",
                data:
                  (target as HTMLAnchorElement).href ||
                  (target.parentElement as HTMLAnchorElement)?.href,
              } satisfies OpenLinkMessage)
            }
          }}
        >
          <InfoCircle />
        </InfoLink>
      </TextfieldWrapper>
      <DisplayContainer>{hasTags && PreviewButton}</DisplayContainer>
    </TextfieldContainer>
  )
}

export default ParsedTextField
