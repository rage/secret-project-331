import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { Eye, Pen } from "@vectopus/atlas-icons-react"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { FloatingHeaderTable } from "../FloatingHeaderTable"

import { getCertificates, updateCertificate } from "@/services/backend/courses/students"
import { CertificateGridRow, CertificateUpdateRequest } from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import DatePickerField from "@/shared-module/common/components/InputFields/DatePickerField"
import TextField from "@/shared-module/common/components/InputFields/TextField"
import Spinner from "@/shared-module/common/components/Spinner"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"
import { useCopyToClipboard } from "@/shared-module/common/hooks/useCopyToClipboard"
import { formatDateForDateInputs } from "@/shared-module/common/utils/time"

const iconBtnStyle = css`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid #d0d5dd;
  background: #fff;
  cursor: pointer;
`

const IconButton: React.FC<{
  label: string
  onClick?: () => void
  children: React.ReactNode
}> = ({ label, onClick, children }) => (
  <button type="button" aria-label={label} title={label} onClick={onClick} className={iconBtnStyle}>
    {children}
  </button>
)

const actionsCellInner = css`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding-left: 0;
  padding-right: 0;
  width: 100%;
`

export const CertificatesTabContent: React.FC<{ courseId?: string; searchQuery: string }> = ({
  courseId,
  searchQuery,
}) => {
  const { t } = useTranslation()
  const [editData, setEditData] = useState<{
    id: string
    name_on_certificate: string
    date: string | null
  } | null>(null)

  const query = useQuery({
    queryKey: ["certificates-tab", courseId],
    queryFn: () => getCertificates(courseId!),
    enabled: !!courseId,
  })

  const allRows = useMemo(() => (query.data ?? []) as CertificateGridRow[], [query.data])

  const rows = useMemo(() => {
    if (!searchQuery.trim()) {
      return allRows
    }
    const queryLower = searchQuery.toLowerCase()
    return allRows.filter((row) => {
      const student = String(row.student ?? "").toLowerCase()
      const certificate = String(row.certificate ?? "").toLowerCase()
      const nameOnCertificate = String(row.name_on_certificate ?? "").toLowerCase()
      return (
        student.includes(queryLower) ||
        certificate.includes(queryLower) ||
        nameOnCertificate.includes(queryLower)
      )
    })
  }, [allRows, searchQuery])
  const [popupUrl, setPopupUrl] = useState<string | null>(null)
  const [verificationId, setVerificationId] = useState<string | null>(null)
  const [imageLoaded, setImageLoaded] = useState(false)
  const verificationUrl = verificationId
    ? // eslint-disable-next-line i18next/no-literal-string
      `${window.location.origin}/certificates/validate/${verificationId}`
    : ""
  const copyToClipboard = useCopyToClipboard(verificationUrl)
  const [copied, setCopied] = useState(false)
  const closePopup = () => {
    setPopupUrl(null)
    setVerificationId(null)
    setCopied(false)
    setImageLoaded(false)
  }

  if (query.isLoading) {
    return <Spinner />
  }
  if (query.isError) {
    return <ErrorBanner error={query.error} />
  }

  const columns: ColumnDef<CertificateGridRow, unknown>[] = [
    // eslint-disable-next-line i18next/no-literal-string
    { header: t("label-student"), accessorKey: "student" },
    // eslint-disable-next-line i18next/no-literal-string
    { header: t("certificate"), accessorKey: "certificate" },
    {
      header: t("name-on-certificate"),
      // eslint-disable-next-line i18next/no-literal-string
      accessorKey: "name_on_certificate",
      cell: ({ getValue }) => {
        const value = getValue<string | null>()
        // eslint-disable-next-line i18next/no-literal-string
        return value ?? "—"
      },
    },
    {
      header: t("date-issued"),
      // eslint-disable-next-line i18next/no-literal-string
      accessorKey: "date_issued",
      cell: ({ getValue }) => {
        const value = getValue<string | null>()
        if (!value) {
          // eslint-disable-next-line i18next/no-literal-string
          return "—"
        }
        const d = new Date(value)
        return d.toISOString().slice(0, 10)
      },
    },
    {
      header: t("actions"),
      // eslint-disable-next-line i18next/no-literal-string
      id: "actions",
      size: 80,
      meta: { style: { paddingLeft: "4px", paddingRight: "4px" } },
      cell: ({ row }) => {
        const { certificate, verification_id } = row.original

        const handleView = () => {
          if (certificate === "Course Certificate" && verification_id) {
            // eslint-disable-next-line i18next/no-literal-string
            setPopupUrl(`/api/v0/main-frontend/certificates/${verification_id}`)
            setVerificationId(verification_id)
          }
        }

        const handleEdit = () => {
          if (row.original.certificate === "Course Certificate" && row.original.certificate_id) {
            setEditData({
              id: row.original.certificate_id,
              name_on_certificate: row.original.name_on_certificate ?? "",
              date: row.original.date_issued,
            })
          }
        }

        return (
          <div className={actionsCellInner}>
            <IconButton label={t("view_certificate")} onClick={handleView}>
              <Eye size={18} />
            </IconButton>

            <IconButton label={t("edit_certificate")} onClick={handleEdit}>
              <Pen size={18} />
            </IconButton>
          </div>
        )
      },
    },
  ]

  return (
    <>
      {popupUrl && verificationId && (
        <StandardDialog
          open={true}
          onClose={closePopup}
          title={t("view_certificate")}
          showCloseButton={true}
          isDismissable={true}
          noPadding={false}
          className={css`
            width: auto !important;
            max-width: 95vw !important;
            max-height: 95vh !important;
          `}
        >
          <div
            className={css`
              display: flex;
              flex-direction: column;
              gap: 1rem;
            `}
          >
            <div
              className={css`
                position: relative;
                width: 800px;
                aspect-ratio: ${imageLoaded ? "auto" : "297 / 210"};
                display: flex;
                align-items: center;
                justify-content: center;
                background: #f5f5f5;
                border-radius: 4px;
              `}
            >
              {!imageLoaded && (
                <div
                  className={css`
                    position: absolute;
                    inset: 0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: #999;
                    font-size: 14px;
                  `}
                >
                  <Spinner variant="medium" />
                </div>
              )}
              <img
                src={popupUrl}
                alt={t("certificate")}
                onLoad={() => setImageLoaded(true)}
                className={css`
                  display: block;
                  width: 800px;
                  height: auto;
                  max-width: 90vw;
                  max-height: 70vh;
                  object-fit: contain;
                  opacity: ${imageLoaded ? 1 : 0};
                  transition: opacity 0.2s ease-in-out;
                `}
              />
            </div>
            <div
              className={css`
                display: flex;
                flex-direction: column;
                gap: 0.5rem;
                padding: 1rem;
                border-top: 1px solid #e5e5e5;
              `}
            >
              <label
                htmlFor="verification-url-input"
                className={css`
                  font-size: 14px;
                  font-weight: 500;
                `}
              >
                {t("verification-url")}
              </label>
              <div
                className={css`
                  display: flex;
                  gap: 0.5rem;
                  align-items: center;
                `}
              >
                <input
                  id="verification-url-input"
                  type="text"
                  readOnly
                  value={verificationUrl}
                  className={css`
                    flex: 1;
                    padding: 8px;
                    border: 1px solid #ccc;
                    border-radius: 4px;
                    font-size: 14px;
                    background: #f5f5f5;
                  `}
                />
                <Button
                  variant="secondary"
                  size="medium"
                  onClick={async () => {
                    const success = await copyToClipboard()
                    if (success) {
                      setCopied(true)
                      setTimeout(() => setCopied(false), 2000)
                    }
                  }}
                >
                  {copied ? t("button-text-copied") : t("button-text-copy")}
                </Button>
              </div>
            </div>
          </div>
        </StandardDialog>
      )}

      {editData && (
        <StandardDialog
          open={true}
          onClose={() => setEditData(null)}
          title={t("edit-certificate")}
          showCloseButton={true}
          isDismissable={true}
          noPadding={false}
          className={css`
            width: 360px !important;
            max-width: 90vw !important;
          `}
        >
          <TextField
            type="text"
            label={t("name-on-certificate")}
            placeholder={t("name-on-certificate")}
            value={editData.name_on_certificate}
            onChange={(e) =>
              setEditData((prev) =>
                prev ? { ...prev, name_on_certificate: e.target.value } : prev,
              )
            }
          />

          <DatePickerField
            label={t("date-issued")}
            value={formatDateForDateInputs(editData.date) ?? ""}
            onChangeByValue={(value) =>
              setEditData((prev) => (prev ? { ...prev, date: value } : prev))
            }
          />

          <div
            className={css`
              display: flex;
              flex-direction: column;
              gap: 0.75rem;
              margin-top: 1rem;
            `}
          >
            <Button
              fullWidth
              size="medium"
              variant="primary"
              onClick={async () => {
                if (!editData) {
                  return
                }

                const iso = new Date(editData.date ?? "").toISOString()

                const payload: CertificateUpdateRequest = {
                  date_issued: iso,
                  name_on_certificate:
                    editData.name_on_certificate?.trim() === ""
                      ? null
                      : editData.name_on_certificate,
                }

                await updateCertificate(editData.id, payload)
                setEditData(null)
                await query.refetch()
              }}
            >
              {t("button-text-update")}
            </Button>

            <Button fullWidth size="medium" variant="secondary" onClick={() => setEditData(null)}>
              {t("button-text-cancel")}
            </Button>
          </div>
        </StandardDialog>
      )}

      <FloatingHeaderTable columns={columns} data={rows} />
    </>
  )
}
