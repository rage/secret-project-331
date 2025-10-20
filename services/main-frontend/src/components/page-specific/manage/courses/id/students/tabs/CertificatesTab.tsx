import { css } from "@emotion/css"
import type { CellContext, ColumnDef } from "@tanstack/react-table"
import { Eye, Pen } from "@vectopus/atlas-icons-react"
import React, { useMemo } from "react"
import { useTranslation } from "react-i18next"

import { FloatingHeaderTable } from "../FloatingHeaderTable"
import { mockStudentsSorted } from "../studentsTableData"
import { iconBtnStyle } from "../studentsTableStyles"

type CertificateRow = {
  student: string
  certificate: string
  date: string
}

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

export const CertificatesTabContent: React.FC = () => {
  const { t } = useTranslation()

  const rows = useMemo<CertificateRow[]>(
    () =>
      mockStudentsSorted.map((s, i) => ({
        student: `${s.lastName ?? ""}${s.lastName && s.firstName ? ", " : ""}${
          s.firstName ?? t("missing-name")
        }`,
        certificate: i % 2 === 0 ? t("course_certificate") : t("no_certificate"),
        date: i % 2 === 0 ? "2025-09-02" : "-",
      })),
    [t],
  )

  const columns = useMemo<ColumnDef<CertificateRow, unknown>[]>(
    () => [
      // eslint-disable-next-line i18next/no-literal-string
      { header: t("label-student"), accessorKey: "student" },
      // eslint-disable-next-line i18next/no-literal-string
      { header: t("certificate"), accessorKey: "certificate" },
      // eslint-disable-next-line i18next/no-literal-string
      { header: t("date-issued"), accessorKey: "date" },
      {
        header: t("actions"),
        // eslint-disable-next-line i18next/no-literal-string
        id: "actions",
        size: 80,
        meta: { style: { paddingLeft: "4px", paddingRight: "4px" } },
        // Explicitly type the cell context so 'row' isn't 'any'
        cell: ({ row }: CellContext<CertificateRow, unknown>) => {
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
    ],
    [t],
  )

  return <FloatingHeaderTable columns={columns} data={rows} />
}
