import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import ParsedText from "./ParsedText"

import Button from "@/shared-module/common/components/Button"
import TextField from "@/shared-module/common/components/InputFields/TextField"

interface TextEditorProps {
  latex?: boolean
  markdown?: boolean
  inline?: boolean
  onChange: (value: string, name?: string) => void
  label: string
  text: string
}

const ToggleButtonStyle = css`
  font-size: 0.8rem;
  margin-left: 0.5rem;
  white-space: normal;
  width: 120px;
  height: 60%;
  top: 32%;
`

const EditorWrapper = styled.div`
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 80px;
`

const FlexWrapper = styled.div`
  flex: 1;
`

const PreviewWrapper = styled.div`
  width: 100%;
  height: 100%;
  background-color: white;
  border: 2px rounded black;
  border-radius: 16px;
  padding: 6px;
  margin: auto;
`

const TextEditor: React.FC<TextEditorProps> = ({
  latex = false,
  markdown = false,
  inline = false,
  onChange,
  label,
  text,
}) => {
  const { t } = useTranslation()
  const [preview, setPreview] = useState(false)

  const togglePreview = () => {
    setPreview(!preview)
  }

  return (
    <EditorWrapper>
      <FlexWrapper>
        {preview ? (
          <PreviewWrapper>
            <ParsedText
              text={text}
              parseLatex={latex}
              parseMarkdown={markdown}
              inline={inline}
              errorText={t("quiz-title-invalid-format")}
            />
          </PreviewWrapper>
        ) : (
          <TextField value={text} label={label} disabled={false} onChangeByValue={onChange} />
        )}
      </FlexWrapper>
      <Button
        transform="capitalize"
        variant="outlined"
        size={"medium"}
        onClick={togglePreview}
        className={ToggleButtonStyle}
      >
        {preview ? t("quiz-edit-title") : t("quiz-preview-title")}
      </Button>
    </EditorWrapper>
  )
}

export default TextEditor
