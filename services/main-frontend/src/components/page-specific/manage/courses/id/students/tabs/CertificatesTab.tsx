import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import type { CellContext, ColumnDef } from "@tanstack/react-table"
import { Eye, Pen } from "@vectopus/atlas-icons-react"
import React, { useMemo, useState } from "react"
import { useTranslation } from "react-i18next"

import { FloatingHeaderTable } from "../FloatingHeaderTable"

import { getCertificates, updateCertificate } from "@/services/backend/courses/students"
import { CertificateGridRow, CertificateUpdateRequest } from "@/shared-module/common/bindings"
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

export const EditCertificateModal = ({ certificateId, currentDate, onClose, onSaved }) => {
  const [dateIssued, setDateIssued] = useState(currentDate?.substring(0, 10))

  const save = async () => {
    const payload: CertificateUpdateRequest = {
      date_issued: new Date(dateIssued).toISOString(),
    }
    const updated = await updateCertificate(certificateId, payload)
    onSaved(updated)
  }

  return (
    <div className="modal">
      <div className="modal-content">
        <input
          type="date"
          value={dateIssued ?? ""}
          onChange={(e) => setDateIssued(e.target.value)}
        />

        <button onClick={save}>Save</button>
        <button onClick={onClose}>Close</button>
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
    queryFn: () => getCertificates(courseId),
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
    { header: t("label-student"), accessorKey: "student" },
    { header: t("certificate"), accessorKey: "certificate" },
    {
      header: t("date-issued"),
      accessorKey: "date_issued",
      cell: ({ getValue }) => {
        const value = getValue<string | null>()
        if (!value) {
          return "—"
        }
        const d = new Date(value)
        return d.toISOString().slice(0, 10)
      },
    },
    {
      header: t("actions"),
      id: "actions",
      size: 80,
      meta: { style: { paddingLeft: "4px", paddingRight: "4px" } },
      cell: ({ row }) => {
        const { certificate, verification_id } = row.original

        const handleView = () => {
          if (certificate === "Course Certificate" && verification_id) {
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
        <div
          className={css`
            position: fixed;
            inset: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
          `}
          onClick={closePopup}
        >
          <div
            className={css`
              position: relative;
              background: white;
              padding: 12px;
              border-radius: 8px;
              max-width: 95vw;
              max-height: 95vh;
            `}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className={css`
                position: absolute;
                top: 8px;
                right: 8px;
                background: #fff;
                border: 1px solid #ccc;
                border-radius: 4px;
                cursor: pointer;
                padding: 4px 8px;
              `}
              onClick={closePopup}
            >
              ✕
            </button>

            <img
              src={popupUrl}
              alt="Certificate"
              className={css`
                max-width: 90vw;
                max-height: 85vh;
                display: block;
              `}
            />
          </div>
        </div>
      )}

      {editData && (
        <StandardDialog
          open={true}
          onClose={() => setEditData(null)}
          title="Edit date issued"
          buttons={[
            {
              children: "Cancel",
              variant: "secondary",
              onClick: () => setEditData(null),
            },
            {
              children: "Update",
              variant: "primary",
              onClick: async () => {
                // Convert YYYY-MM-DD → ISO string
                const iso = new Date(editData.date ?? "").toISOString()

                const payload: CertificateUpdateRequest = {
                  date_issued: iso,
                }

                await updateCertificate(editData.id, payload)
                setEditData(null)
                query.refetch()
              },
            },
          ]}
        >
          <input
            type="date"
            value={editData.date?.substring(0, 10) ?? ""}
            onChange={(e) =>
              setEditData((prev) => (prev ? { ...prev, date: e.target.value } : prev))
            }
          />
        </StandardDialog>
      )}

      {/* TABLE */}
      <FloatingHeaderTable columns={columns} data={rows} />
    </>
  )
}
