import { InputProps, Link, Paper, Tab, Tabs, TextField } from "@material-ui/core"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import styled from "styled-components"

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
  flex-wrap: wrap;
`

export interface ExerciseEditorProps {
  onChange: InputProps["onChange"]
  text: string
  label: string
}

export const MarkdownEditor: React.FC<ExerciseEditorProps> = ({ text, label, onChange }) => {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState(0)
  const [, setShowTabs] = useState(text.length > 0)

  useEffect(() => {
    setShowTabs(text.length > 0)
  }, [text])
  return (
    <>
      <EditorWrapper>
        <StyledAppBar>
          <Tabs
            // eslint-disable-next-line i18next/no-literal-string
            indicatorColor="primary"
            value={activeTab}
            onChange={(_, value) => {
              setActiveTab(value)
            }}
          >
            <Tab label={t("label-source")} />
            <Tab label={t("label-preview")} />
          </Tabs>
        </StyledAppBar>
        <HelperText>{t("markdown-editor-help-text")}</HelperText>
        {activeTab === 0 && (
          <TextField
            label={label}
            fullWidth
            variant="outlined"
            type="text"
            value={text}
            onChange={onChange}
            maxRows={1000}
            multiline
            required
          />
        )}
        {activeTab === 1 && <MarkdownText text={text} />}
      </EditorWrapper>
    </>
  )
}

export default MarkdownEditor
