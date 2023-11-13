import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { Eye, Pencil } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "../../../../../shared-module/components/Button"
import TextField from "../../../../../shared-module/components/InputFields/TextField"
import ParsedText from "../../../../ParsedText"

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

const LATEX_TAGS = /\[\/?latex\]/g
const MARKDOWN_TAGS = /\[\/?markdown\]/g

/**
 * Checks if there exists tags such as [latex][/latex] or [markdown][/markdown]
 * @param text Text to parse from
 */
const containsTags = (text: string) => {
  return [...text.matchAll(LATEX_TAGS), ...text.matchAll(MARKDOWN_TAGS)].length > 0
}

interface ParsedTextFieldProps {
  label: string
  value: string | null
  onChange: (value: string) => void
}

const ParsedTextField: React.FC<ParsedTextFieldProps> = ({ label, value, onChange }) => {
  const [preview, setPreview] = useState(false)
  const [text, setText] = useState("")

  const hasTags = containsTags(text)

  const { t } = useTranslation()

  const PreviewButton = preview ? (
    <>
      <Button
        className={css`
          display: flex !important;
          align-items: center;
          border: 1px solid #dae6e5 !important;
          margin: 2px 0px 4px 0px !important;
          height: 24px;
          cursor: pointer;
          :hover {
            border: 1px solid #bcd1d0;
          }
        `}
        variant="icon"
        size="small"
        onClick={() => {
          setPreview(!preview)
        }}
      >
        <Pencil size={16} />
      </Button>

      <p> {t("edit-text")} </p>
    </>
  ) : (
    <>
      <Button
        className={css`
          display: flex !important;
          align-items: center;
          border: 1px solid #dae6e5 !important;
          margin: 2px 0px 4px 0px !important;
          height: 24px;
          cursor: pointer;
          :hover {
            border: 1px solid #bcd1d0;
          }
        `}
        variant="icon"
        size="small"
        onClick={() => {
          setPreview(!preview)
        }}
      >
        <Eye size={18} />
      </Button>
      <p> {t("preview-rendered-text")} </p>
    </>
  )

  const handleOnChange = (value: string) => {
    onChange(value)
    setText(value)
  }

  return (
    <TextfieldContainer>
      {preview ? (
        <ParsedTextContainer>
          <ParsedText text={value} parseMarkdown parseLatex inline />
        </ParsedTextContainer>
      ) : (
        <TextField
          value={value ?? undefined}
          onChangeByValue={(value) => handleOnChange(value)}
          label={label}
        />
      )}
      <DisplayContainer>{hasTags && PreviewButton}</DisplayContainer>
    </TextfieldContainer>
  )
}

export default ParsedTextField
