import { css } from "@emotion/css"
import styled from "@emotion/styled"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import Button from "../shared-module/common/components/Button"
import TextField from "../shared-module/common/components/InputFields/TextField"

import MarkdownText from "./MarkdownText"

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
  return (
    <>
      <EditorWrapper>
        {!previewVisible && (
          <div
            className={css`
              flex: 1;
            `}
          >
            <TextField value={text} label={label} disabled={false} onChangeByValue={onChange} />
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
          transform="capitalize"
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
