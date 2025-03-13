import { css } from "@emotion/css"
import { Parser } from "@json2csv/plainjs"
import { BugInsect, DownloadArrowDown as Download } from "@vectopus/atlas-icons-react"
import { Dispatch, useCallback, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { baseTheme } from "../styles/theme"

import Button from "./Button"
import StandardDialog from "./StandardDialog"
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
  const [editedContent, setEditedContent] = useState<string>()

  const stringifiedData = useMemo(() => {
    return JSON.stringify(data, null, 2)
  }, [data])

  // Memoize the stringification and size check together
  const { size } = useMemo(
    () => ({
      size: new Blob([JSON.stringify(data)]).size,
    }),
    [data],
  )

  // Combine all data validation into one memo
  const isDownloadable = useMemo(() => {
    if (!Array.isArray(data) || data.length === 0) {
      return false
    }
    if (size > MAX_CSV_EXPORT_SIZE_BYTES) {
      console.warn("Data too large for CSV download")
      return false
    }
    try {
      new Parser().parse(data)
      return true
    } catch (_error) {
      return false
    }
  }, [data, size])

  const closeModal = useCallback(() => {
    if (updateDataOnClose && editedContent) {
      try {
        updateDataOnClose(JSON.parse(editedContent))
      } catch (err) {
        console.error("Failed to parse edited content:", err)
      }
    }
    setOpen(false)
    setEditedContent(undefined) // Reset the edited content when closing
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
            aria-label={t("title-data-view")}
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
            aria-label={t("title-data-view")}
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
      <StandardDialog
        open={open}
        onClose={closeModal}
        width="wide"
        noPadding
        disableContentScroll
        title={
          <>
            {t("title-data-view")}
            <span
              className={css`
                color: ${baseTheme.colors.gray[700]};
                font-weight: normal;
                font-size: 0.9em;
                margin-left: 0.5rem;
              `}
            >
              ({readOnlySpecifier})
            </span>
          </>
        }
        className={css`
          overflow: hidden;
        `}
        actionButtons={
          isDownloadable && (
            <Button variant="secondary" size="medium" onClick={handleDownloadCSV}>
              <Download size={16} weight="bold" />
              <span
                className={css`
                  margin-left: 0.5rem;
                `}
              >
                {t("download-csv")}
              </span>
            </Button>
          )
        }
      >
        <MonacoEditor
          height="90vh"
          defaultLanguage="json"
          options={{ wordWrap: ON, readOnly }}
          defaultValue={editedContent || undefined}
          onChange={handleEditorChange}
        />
      </StandardDialog>
    </>
  )
}

export default DebugModal
