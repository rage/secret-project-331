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
  const messagePort = useContext(MessagePortContext)

  const { t } = useTranslation()

  // Derived straight from the value prop (not a second state copy) so it can never go stale
  // when the parent resets the value — e.g. clearing the "add option" field would otherwise
  // leave the emptied field stuck in multiline mode.
  const text = value ?? ""

  // Single line by default; a [markdown] block needs the room for line breaks, so it promotes
  // the field to a multiline textarea. Triggered by the presence of a markdown tag (not a
  // complete pair) so the field is already multiline while the author is building the block —
  // otherwise Enter is suppressed (AutoExpandingTextField) and a block can't be composed.
  const multiline = useMemo(() => containsMarkdownTag(text), [text])

  // The preview toggle appears for any markdown or latex tag. Uses the same lenient tag-presence
  // check as `multiline` so the preview affordance and the multiline state never disagree about
  // the same text.
  const hasTags = useMemo(() => containsRenderableTag(text), [text])

  const PreviewButton = (
    <>
      <StyledButton variant="icon" size="small" onClick={() => setPreview(!preview)}>
        {preview ? <Pencil size={16} /> : <Eye size={18} />}
      </StyledButton>
      <p> {preview ? t("edit-text") : t("preview-rendered-text")} </p>
    </>
  )

  const handleOnChange = (rawValue: string) => {
    // Keep a plain single-line field behaving like a native <input>: collapse any newline a
    // paste would introduce. Once the text contains a markdown tag the field is multiline, so
    // line breaks are preserved — including while a tag is mid-edit, which is what stops a single
    // keystroke on the closing tag from silently flattening an author's existing line breaks.
    const next = containsMarkdownTag(rawValue) ? rawValue : toSingleLine(rawValue)
    onChange(next)
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
