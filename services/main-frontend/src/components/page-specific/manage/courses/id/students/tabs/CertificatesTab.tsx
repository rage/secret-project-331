import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import type { CellContext, ColumnDef } from "@tanstack/react-table"
import { Eye, Pen } from "@vectopus/atlas-icons-react"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { FloatingHeaderTable } from "../FloatingHeaderTable"

import { getCertificates } from "@/services/backend/courses/students"
import { CertificateGridRow } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"

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
export const CertificatesTabContent: React.FC<{ courseId?: string }> = ({ courseId }) => {
  const { t } = useTranslation()

  const query = useQuery({
    queryKey: ["certificates-tab", courseId],
    queryFn: () => getCertificates(courseId),
  })

  if (query.isLoading) {
    return <Spinner />
  }
  if (query.isError) {
    return <ErrorBanner error={query.error} />
  }

  console.log("YEP",query)

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
        return d.toISOString().slice(0, 10) // YYYY-MM-DD
      },
    },
    {
      header: t("actions"),
      // eslint-disable-next-line i18next/no-literal-string
      id: "actions",
      size: 80,
      meta: { style: { paddingLeft: "4px", paddingRight: "4px" } },
      cell: ({ row }: CellContext<CertificateGridRow, unknown>) => {
        const handleView = () => console.log("View certificate for:", row.original.student)
        const handleEdit = () => console.log("Edit certificate for:", row.original.student)
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

  return <FloatingHeaderTable columns={columns} data={rows} />
}
