"use client"

import styled from "@emotion/styled"
import { Eye, InfoCircle, Pencil } from "@vectopus/atlas-icons-react"
import React, { useContext, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import ParsedText from "../../../../ParsedText"

import AutoExpandingTextField from "./AutoExpandingTextField"
import { toSingleLine } from "./singleLine"
import { containsMarkdownTag, containsRenderableTag } from "./tagBlocks"

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
  /* Wrap long lines and break unbreakable tokens instead of overflowing to the right. */
  white-space: normal;
  overflow-wrap: break-word;
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
  /* Allow the flex item to shrink below its content width so the preview wraps to the row. */
  min-width: 0;
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
  const messagePort = useContext(MessagePortContext)

  const { t } = useTranslation()

  // Derived from the prop, not a second state copy, so it can't go stale when the parent resets
  // the value (e.g. clearing the "add option" field).
  const text = value ?? ""

  // Multiline once a markdown tag is present, so a block can be composed/edited without Enter
  // being suppressed (see AutoExpandingTextField).
  const multiline = useMemo(() => containsMarkdownTag(text), [text])

  // Preview toggle shows for any markdown or latex tag.
  const hasTags = useMemo(() => containsRenderableTag(text), [text])

  // Only preview while tags are present: the toggle is hidden without them, so a stale preview=true
  // (e.g. after the parent clears the value) would otherwise strand the field in the preview branch.
  const showPreview = preview && hasTags

  const PreviewButton = (
    <>
      <StyledButton variant="icon" size="small" onClick={() => setPreview(!preview)}>
        {preview ? <Pencil size={16} /> : <Eye size={18} />}
      </StyledButton>
      <p> {preview ? t("edit-text") : t("preview-rendered-text")} </p>
    </>
  )

  const handleOnChange = (rawValue: string) => {
    // Single-line fields collapse pasted newlines; with a markdown tag present newlines are kept,
    // so editing a tag can't flatten existing line breaks.
    const next = containsMarkdownTag(rawValue) ? rawValue : toSingleLine(rawValue)
    onChange(next)
  }

  return (
    <TextfieldContainer>
      <TextfieldWrapper>
        <Grow>
          {showPreview ? (
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
