import { css } from "@emotion/css"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import styled from "styled-components"

import Button from "../shared-module/components/Button"
import TextField from "../shared-module/components/InputFields/TextField"

import { MarkdownText } from "./MarkdownText"

const EditorWrapper = styled.div`
  width: 100%;
  display: flex;
  flex-direction: row;
`

export interface MarkdownEditorProps {
  onChange: (value: string, name?: string) => void
  text: string
  label: string
}

export const MarkdownEditor: React.FC<MarkdownEditorProps> = ({ text, label, onChange }) => {
  const { t } = useTranslation()
  const [previewVisible, setPreviewVisible] = useState(false)
  const [, setShowTabs] = useState(text.length > 0)

  useEffect(() => {
    setShowTabs(text.length > 0)
  }, [text])
  return (
    <>
      <EditorWrapper>
        {!previewVisible && (
          <div
            className={css`
              flex: 1;
            `}
          >
            <TextField value={text} label={label} disabled={false} onChange={onChange} />
          </div>
        )}
        {previewVisible && (
          <div
            className={css`
              flex: 1;
            `}
          >
            <MarkdownText text={text} />
          </div>
        )}
        <Button
          transform="normal"
          variant="outlined"
          size={"medium"}
          onClick={() => setPreviewVisible(!previewVisible)}
          className={css`
            white-space: normal !important;
            width: 100px;
            font-size: 0.8rem !important;
            margin-left: 0.5rem;
          `}
        >
          {t("markdown-preview")}
        </Button>
      </EditorWrapper>
    </>
  )
}

export default MarkdownEditor
