import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { BugInsect } from "@vectopus/atlas-icons-react"
import { Dispatch, useState } from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../styles/theme"

import Button from "./Button"
import Dialog from "./Dialog"
import MonacoEditor from "./monaco/MonacoEditor"

export interface DebugModalProps {
  data: unknown
  readOnly?: boolean
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  updateDataOnClose?: Dispatch<any>
  buttonSize?: "small" | "medium" | "large"
  variant?: "default" | "minimal"
  buttonWrapperStyles?: string
}

const HeaderBar = styled.div`
  display: flex;
  padding: 0.5rem;
  align-items: center;
  h1 {
    font-size: 1.25rem;
    margin-bottom: 0;
  }
`

const iconButtonStyles = css`
  background: none;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  color: ${baseTheme.colors.gray[400]};
  transition: color 0.2s ease;

  &:hover {
    color: ${baseTheme.colors.green[600]};
  }
`

const DebugModal: React.FC<React.PropsWithChildren<DebugModalProps>> = ({
  data,
  readOnly = true,
  updateDataOnClose,
  buttonSize = "medium",
  variant = "default",
  buttonWrapperStyles,
}) => {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [editedContent, setEditedContent] = useState<string | null>(null)

  const closeModal = () => {
    setOpen(false)
    if (updateDataOnClose) {
      let parsed = null
      if (typeof editedContent === "string") {
        parsed = JSON.parse(editedContent)
      }
      updateDataOnClose(parsed)
    }
  }

  const openModal = () => {
    setEditedContent(JSON.stringify(data, undefined, 2))
    setOpen(true)
  }

  const readOnlySpecifier = readOnly ? t("read-only") : t("editable")

  return (
    <>
      <div className={buttonWrapperStyles}>
        {variant === "minimal" ? (
          <button
            type="button"
            aria-label={t("debug")}
            onClick={() => openModal()}
            className={iconButtonStyles}
          >
            <BugInsect size={14} weight="bold" />
          </button>
        ) : (
          <Button
            variant="blue"
            size={buttonSize}
            aria-label={t("debug")}
            onClick={() => openModal()}
            className={css`
              height: 41px;
              padding: 8px;
              color: white !important;
            `}
          >
            <BugInsect size={16} weight="bold" />
          </Button>
        )}
      </div>
      <Dialog
        width="wide"
        open={open}
        onClose={closeModal}
        noPadding
        className={css`
          overflow: hidden;
        `}
      >
        <HeaderBar>
          <h1>
            {t("title-debug-view")} ({readOnlySpecifier})
          </h1>
          <div
            className={css`
              flex-grow: 1;
            `}
          />
          <Button variant="primary" size="medium" onClick={closeModal}>
            {t("close")}
          </Button>
        </HeaderBar>
        <MonacoEditor
          height="90vh"
          defaultLanguage="json"
          // eslint-disable-next-line i18next/no-literal-string
          options={{ wordWrap: "on", readOnly }}
          defaultValue={editedContent || undefined}
          onChange={(value) => value && setEditedContent(value)}
        />
      </Dialog>
    </>
  )
}

export default DebugModal
