"use client"

import styled from "@emotion/styled"
import { Eye, InfoCircle, Pencil } from "@vectopus/atlas-icons-react"
import React, { useContext, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import ParsedText from "../../../../ParsedText"

import AutoExpandingTextField from "./AutoExpandingTextField"
import { toSingleLine } from "./singleLine"
import { containsLatexBlock, containsMarkdownBlock } from "./tagBlocks"

import MessagePortContext from "@/contexts/MessagePortContext"
import Button from "@/shared-module/common/components/Button"
import { OpenLinkMessage } from "@/shared-module/exercise-protocol/core/exercise-service-protocol-types"

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
  min-height: 68px;
  max-height: 300px;
  overflow-y: auto;
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
  const messagePort = useContext(MessagePortContext)

  const { t } = useTranslation()

  const containsMarkdown = useMemo(() => containsMarkdownBlock(text), [text])

  const containsLatex = useMemo(() => containsLatexBlock(text), [text])

  const hasTags = useMemo(
    () => containsMarkdown || containsLatex,
    [containsMarkdown, containsLatex],
  )

  // Single line by default; only a markdown block needs the room for line
  // breaks, so it promotes the field to a multiline textarea.
  const multiline = containsMarkdown

  const PreviewButton = (
    <>
      <StyledButton variant="icon" size="small" onClick={() => setPreview(!preview)}>
        {preview ? <Pencil size={16} /> : <Eye size={18} />}
      </StyledButton>
      <p> {preview ? t("edit-text") : t("preview-rendered-text")} </p>
    </>
  )

  const handleOnChange = (rawValue: string) => {
    // While collapsed (no markdown block), keep the value single-line so the field stays
    // input-like; once a markdown block is present, preserve line breaks for the multiline
    // editing that the block enables.
    const next = containsMarkdownBlock(rawValue) ? rawValue : toSingleLine(rawValue)
    onChange(next)
    setText(next)
  }

  return (
    <TextfieldContainer>
      <TextfieldWrapper>
        <Grow>
          {preview ? (
            <ParsedTextContainer>
              <ParsedText text={value} parseMarkdown parseLatex inline />
            </ParsedTextContainer>
          ) : (
            <AutoExpandingTextField
              multiline={multiline}
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
