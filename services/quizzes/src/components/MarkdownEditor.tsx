import { css } from "@emotion/css"
import { InputProps, Paper, Tab, Tabs } from "@material-ui/core"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import styled from "styled-components"

import Button from "../shared-module/components/Button"
import TextArea from "../shared-module/components/InputFields/TextAreaField"
import TextField from "../shared-module/components/InputFields/TextField"

import { MarkdownText } from "./MarkdownText"

const StyledAppBar = styled(Paper)`
  margin-bottom: 1rem;
  .MuiTabs-indicator {
    background-color: #8398f9;
    height: 0.25rem;
  }
`

const HelperText = styled.h4`
  font-size: 80% !important;
  display: flex !important;
  color: #9e9e9e !important;
  margin-top: 1rem !important;
  margin-bottom: 1rem !important;
  margin-left: 1rem !important;
  margin-right: 1rem !important;
`

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

{
  /* <TextField
            label={label}
            fullWidth
            variant="outlined"
            type="text"
            value={text}
            onChange={onChange}
            maxRows={1000}
            multiline
            required
          /> */
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
