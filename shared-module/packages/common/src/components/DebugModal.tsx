"use client"

import { css } from "@emotion/css"
import { Parser } from "@json2csv/plainjs"
import { BugInsect, DownloadArrowDown as Download } from "@vectopus/atlas-icons-react"
import type { Dispatch } from "react"
import { useCallback, useMemo, useRef, useState } from "react"
import { useTranslation } from "react-i18next"

import { Button } from "@/shared-module/components/components/Button"
import type { DialogAction } from "@/shared-module/components/components/Dialog"
import { Dialog } from "@/shared-module/components/components/Dialog"

import { includeIf } from "../utils/nullability"
import MonacoEditor from "./monaco/MonacoEditor"

export interface DebugModalProps {
  data: unknown
  readOnly?: boolean
  /** Called with the parsed, edited JSON when the modal closes, if the content was edited. */
  // oxlint-disable-next-line typescript/no-explicit-any
  updateDataOnClose?: Dispatch<any>
  buttonSize?: "small" | "medium" | "large"
  /** `"minimal"` renders a bare icon button instead of the full button as the trigger. */
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
  color: var(--color-gray-400);
  transition: color 0.2s ease;

  &:hover {
    color: var(--color-green-600);
  }
`

const titleSuffixStyles = css`
  color: var(--color-gray-700);
  font-weight: normal;
  font-size: 0.9em;
  margin-left: 0.5rem;
`

const ON = "on"

// Limit so that we don't freeze the browser
const MAX_CSV_EXPORT_SIZE_BYTES = 10 * 1024 * 1024

/** Dev/admin tool: shows `data` as a JSON blob in an editor, with an optional CSV export. */
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
  const editedContentRef = useRef<string | undefined>("")

  const stringifiedData = useMemo(() => {
    return JSON.stringify(data, null, 2)
  }, [data])

  const { size } = useMemo(
    () => ({
      size: new Blob([JSON.stringify(data)]).size,
    }),
    [data],
  )

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
    if (updateDataOnClose && editedContentRef.current) {
      try {
        updateDataOnClose(JSON.parse(editedContentRef.current))
      } catch (err) {
        console.error("Failed to parse edited content:", err)
      }
    }
    setOpen(false)
    editedContentRef.current = undefined
  }, [updateDataOnClose])

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
      document.body.append(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("Failed to generate CSV:", error)
    }
  }, [data])

  const handleEditorChange = useCallback((value: string | undefined) => {
    if (value !== undefined) {
      editedContentRef.current = value
    }
  }, [])

  const readOnlySpecifier = readOnly ? t("read-only") : t("editable")

  const csvDownloadAction: DialogAction = {
    label: t("download-csv"),
    icon: <Download size={16} weight="bold" />,
    variant: "secondary",
    onClick: handleDownloadCSV,
  }

  return (
    <>
      <div className={buttonWrapperStyles}>
        {variant === "minimal" ? (
          <button
            type="button"
            aria-label={t("title-data-view")}
            onClick={() => {
              editedContentRef.current = stringifiedData
              setOpen(true)
            }}
            className={iconButtonStyles}
          >
            <BugInsect size={14} weight="bold" />
          </button>
        ) : (
          <Button
            variant="icon"
            size={buttonSize}
            aria-label={t("title-data-view")}
            onClick={() => {
              editedContentRef.current = stringifiedData
              setOpen(true)
            }}
          >
            <BugInsect size={16} weight="bold" />
          </Button>
        )}
      </div>
      <Dialog
        open={open}
        onClose={closeModal}
        size="wide"
        padding="none"
        title={
          <>
            {t("title-data-view")}
            <span className={titleSuffixStyles}>({readOnlySpecifier})</span>
          </>
        }
        {...includeIf(isDownloadable, { actions: [csvDownloadAction] as const })}
      >
        <MonacoEditor
          height="90vh"
          defaultLanguage="json"
          options={{ wordWrap: ON, readOnly }}
          defaultValue={stringifiedData}
          onChange={handleEditorChange}
        />
      </Dialog>
    </>
  )
}

export default DebugModal
