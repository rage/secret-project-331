import styled from "@emotion/styled"
import { faEye, faPencil } from "@fortawesome/free-solid-svg-icons"
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import TextField from "../../../../shared-module/components/InputFields/TextField"
import ParsedText from "../../../ParsedText"

const DisplayContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 6px;
  margin-top: 4px;
`
const RectangleButton = styled(FontAwesomeIcon)`
  border: 1px solid #dae6e5;
  height: 12.6px;
  width: 22.5px;
  padding: 4px;
  display: inline;
  cursor: pointer;
  margin-left: 2px;

  :hover {
    border: 1px solid #bcd1d0;
  }
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
  value: string
  onChange: (value: string) => void
}

const ParsedTextField: React.FC<ParsedTextFieldProps> = ({ label, value, onChange }) => {
  const [preview, setPreview] = useState(false)
  const [text, setText] = useState("")

  const hasTags = containsTags(text)

  const { t } = useTranslation()

  const PreviewButton = preview ? (
    <>
      <RectangleButton
        onClick={() => {
          setPreview(!preview)
        }}
        icon={faPencil}
      />
      <p> {t("edit-text")} </p>
    </>
  ) : (
    <>
      <RectangleButton
        onClick={() => {
          setPreview(!preview)
        }}
        icon={faEye}
      />
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
        <TextField value={value} onChangeByValue={(value) => handleOnChange(value)} label={label} />
      )}
      <DisplayContainer>{hasTags && PreviewButton}</DisplayContainer>
    </TextfieldContainer>
  )
}

export default ParsedTextField
