import { css } from "@emotion/css"
import styled from "@emotion/styled"
import { Parser } from "@json2csv/plainjs"
import { BugInsect, DownloadArrowDown as Download } from "@vectopus/atlas-icons-react"
import { Dispatch, useCallback, useMemo, useState } from "react"
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

const ON = "on"

// Limit so that we don't freeze the browser
const MAX_CSV_EXPORT_SIZE_BYTES = 10 * 1024 * 1024

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

  // Memoize the stringification and size check together
  const { stringifiedData, size } = useMemo(
    () => ({
      stringifiedData: JSON.stringify(data, undefined, 2),
      size: new Blob([JSON.stringify(data)]).size,
    }),
    [data],
  )

  // Combine all data validation into one memo
  const isDownloadable = useMemo(() => {
    if (!Array.isArray(data)) {
      return false
    }
    if (size > MAX_CSV_EXPORT_SIZE_BYTES) {
      console.warn("Data too large for CSV download")
      return false
    }
    try {
      new Parser().parse(data)
      return true
    } catch (error) {
      console.error("CSV validation failed:", error)
      return false
    }
  }, [data, size])

  const closeModal = useCallback(() => {
    setOpen(false)
    if (updateDataOnClose) {
      let parsed = null
      if (typeof editedContent === "string") {
        try {
          parsed = JSON.parse(editedContent)
        } catch (error) {
          console.error("Failed to parse JSON:", error)
        }
      }
      updateDataOnClose(parsed)
    }
  }, [editedContent, updateDataOnClose])

  const handleDownloadCSV = useCallback(() => {
    if (!Array.isArray(data) || !data.every((item) => typeof item === "object" && item !== null)) {
      return
    }

    try {
      const parser = new Parser()
      const csvContent = parser.parse(data)

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", "data.csv")
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to generate CSV:", error)
    }
  }, [data])

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value) {
      setEditedContent(value)
    }
  }, [])

  const readOnlySpecifier = readOnly ? t("read-only") : t("editable")

  return (
    <>
      <div className={buttonWrapperStyles}>
        {variant === "minimal" ? (
          <button
            type="button"
            aria-label={t("debug")}
            onClick={() => {
              setEditedContent(stringifiedData)
              setOpen(true)
            }}
            className={iconButtonStyles}
          >
            <BugInsect size={14} weight="bold" />
          </button>
        ) : (
          <Button
            variant="blue"
            size={buttonSize}
            aria-label={t("debug")}
            onClick={() => {
              setEditedContent(stringifiedData)
              setOpen(true)
            }}
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
          {isDownloadable && (
            <Button
              variant="blue"
              size="medium"
              onClick={handleDownloadCSV}
              className={css`
                margin-right: 0.5rem;
              `}
            >
              <Download size={16} weight="bold" />
              <span
                className={css`
                  margin-left: 0.5rem;
                `}
              >
                {t("download-csv")}
              </span>
            </Button>
          )}
          <Button variant="primary" size="medium" onClick={closeModal}>
            {t("close")}
          </Button>
        </HeaderBar>
        <MonacoEditor
          height="90vh"
          defaultLanguage="json"
          options={{ wordWrap: ON, readOnly }}
          defaultValue={editedContent || undefined}
          onChange={handleEditorChange}
        />
      </Dialog>
    </>
  )
}

export default DebugModal
