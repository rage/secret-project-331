import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { Eye, XmarkCircle } from "@vectopus/atlas-icons-react"
import React, { useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import ParsedText from "./ParsedText"

import TextAreaField from "@/shared-module/common/components/InputFields/TextAreaField"
import TextField from "@/shared-module/common/components/InputFields/TextField"

const EditorWrapper = styled.div`
  width: 100%;
  display: flex;
  flex-direction: row;
`

const IconButton = styled.button`
  background: none;
  border: none;
  cursor: pointer;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`

const PreviewBox = styled.div`
  flex: 1;
  padding: 1rem;
  border: 1px solid #ccc;
  background-color: #f9f9f9;
`

export interface MarkdownEditorProps {
  onChange: (value: string, name?: string) => void
  text: string
  label: string
}

export const MarkdownEditor: React.FC<React.PropsWithChildren<MarkdownEditorProps>> = ({
  text,
  label,
  onChange,
}) => {
  const { t } = useTranslation()
  const [previewVisible, setPreviewVisible] = useState(false)
  const [, setShowTabs] = useState(text.length > 0)

  useEffect(() => {
    setShowTabs(text.length > 0)
  }, [text])

  const containsMarkdown = useMemo(
    () => text.includes("[markdown]") && text.includes("[/markdown]"),
    [text],
  )

  return (
    <>
      <EditorWrapper>
        {!previewVisible && (
          <div
            className={css`
              flex: 1;
            `}
          >
            {containsMarkdown ? (
              <TextAreaField
                autoResize
                value={text}
                label={label}
                disabled={false}
                onChangeByValue={onChange}
              />
            ) : (
              <TextField value={text} label={label} disabled={false} onChangeByValue={onChange} />
            )}
          </div>
        )}
        {previewVisible && (
          <PreviewBox>
            <ParsedText inline parseLatex parseMarkdown text={text} />
          </PreviewBox>
        )}
        {containsMarkdown && (
          <IconButton
            onClick={() => setPreviewVisible(!previewVisible)}
            aria-label={previewVisible ? t("hide-markdown-preview") : t("markdown-preview")}
            className={css`
              margin-left: 0.5rem;
            `}
          >
            {previewVisible ? <XmarkCircle /> : <Eye />}
          </IconButton>
        )}
      </EditorWrapper>
    </>
  )
}

export default MarkdownEditor
