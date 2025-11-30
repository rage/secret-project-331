import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import type { ColumnDef } from "@tanstack/react-table"
import { Eye, Pen } from "@vectopus/atlas-icons-react"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { FloatingHeaderTable } from "../FloatingHeaderTable"

import { getCertificates, updateCertificate } from "@/services/backend/courses/students"
import {
  CertificateGridRow,
  CertificateUpdateRequest,
  GeneratedCertificate,
} from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import StandardDialog from "@/shared-module/common/components/dialogs/StandardDialog"

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

type EditCertificateModalProps = {
  certificateId: string
  currentDate: string | null
  onClose: () => void
  onSaved: (updated: CertificateGridRow) => void
}

const convertToGridRow = (g: GeneratedCertificate): CertificateGridRow => ({
  student: g.student ?? "",
  certificate: g.certificate ?? "",
  date_issued: g.date_issued ?? null,
  certificate_id: g.certificate_id ?? "",
  verification_id: g.verification_id ?? "",
})

export const EditCertificateModal: React.FC<EditCertificateModalProps> = ({
  certificateId,
  currentDate,
  onClose,
  onSaved,
}) => {
  const [dateIssued, setDateIssued] = useState(currentDate?.substring(0, 10))
  const { t } = useTranslation()

  const save = async () => {
    const payload: CertificateUpdateRequest = {
      date_issued: new Date(dateIssued ?? "").toISOString(),
    }
    const updated = await updateCertificate(certificateId, payload)
    onSaved(convertToGridRow(updated))
  }

  return (
    <div className="modal">
      <div className="modal-content">
        <input
          type="date"
          value={dateIssued ?? ""}
          onChange={(e) => setDateIssued(e.target.value)}
        />

        <button onClick={save}>{t("button-text-save")}</button>
        <button onClick={onClose}>{t("button-text-close")}</button>
      </div>
    </div>
  )
}

export const CertificatesTabContent: React.FC<{ courseId?: string }> = ({ courseId }) => {
  const { t } = useTranslation()
  const [editData, setEditData] = useState<{
    id: string
    date: string | null
  } | null>(null)

  const query = useQuery({
    queryKey: ["certificates-tab", courseId],
    queryFn: () => getCertificates(courseId!),
    // Run only after we have courseId
    enabled: !!courseId,
  })

  const [popupUrl, setPopupUrl] = React.useState<string | null>(null)
  const closePopup = () => setPopupUrl(null)

  if (query.isLoading) {
    return <Spinner />
  }
  if (query.isError) {
    return <ErrorBanner error={query.error} />
  }

  console.log("TEST", query)

  const columns: ColumnDef<CertificateGridRow, unknown>[] = [
    // eslint-disable-next-line i18next/no-literal-string
    { header: t("label-student"), accessorKey: "student" },
    // eslint-disable-next-line i18next/no-literal-string
    { header: t("certificate"), accessorKey: "certificate" },
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
          }
        }

        const handleEdit = () => {
          if (row.original.certificate === "Course Certificate") {
            setEditData({
              id: row.original.certificate_id!,
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

  const rows = (query.data ?? []) as CertificateGridRow[]

  return (
    <>
      {/* POPUP */}
      {popupUrl && (
        <StandardDialog
          open={true}
          onClose={closePopup}
          title={t("view_certificate")}
          showCloseButton={true}
          isDismissable={true}
          noPadding={true}
          className={css`
            width: auto !important;
            max-width: 95vw !important;
            max-height: 95vh !important;
            padding: 0;
          `}
        >
          <img
            src={popupUrl}
            alt={t("certificate")}
            className={css`
              display: block;

              width: auto;
              height: auto;

              max-width: 90vw;
              max-height: 80vh;

              object-fit: contain;
            `}
          />
        </StandardDialog>
      )}

      {editData && (
        <StandardDialog
          open={true}
          onClose={() => setEditData(null)}
          title={t("edit-date-issued")}
          showCloseButton={true}
          isDismissable={true}
          noPadding={false}
          className={css`
            width: 360px !important; /* narrower dialog */
            max-width: 90vw !important; /* prevent overflow on small screens */
          `}
        >
          <input
            type="date"
            value={editData.date?.substring(0, 10) ?? ""}
            onChange={(e) =>
              setEditData((prev) => (prev ? { ...prev, date: e.target.value } : prev))
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
                const iso = new Date(editData.date ?? "").toISOString()
                const payload: CertificateUpdateRequest = { date_issued: iso }
                await updateCertificate(editData.id, payload)
                setEditData(null)
                query.refetch()
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

      {/* TABLE */}
      <FloatingHeaderTable columns={columns} data={rows} />
    </>
  )
}
