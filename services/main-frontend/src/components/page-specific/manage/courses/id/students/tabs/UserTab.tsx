import React from "react"
import { useTranslation } from "react-i18next"

import { FloatingHeaderTable } from "../FloatingHeaderTable"
import { mockStudentsSorted } from "../studentsTableData"

export const UserTabContent: React.FC = () => {
  const { t } = useTranslation()

  return (
    <FloatingHeaderTable
      columns={[
        {
          header: t("label-name"),
          // eslint-disable-next-line i18next/no-literal-string
          id: "name",
          accessorFn: (row: { firstName: string | null; lastName: string | null }) =>
            `${row.lastName ? row.lastName : ""}${row.lastName && row.firstName ? ", " : ""}${
              row.firstName ? row.firstName : t("missing-name")
            }`,
        },
        // eslint-disable-next-line i18next/no-literal-string
        { header: t("user-id"), accessorKey: "userId" },
        // eslint-disable-next-line i18next/no-literal-string
        { header: t("label-email"), accessorKey: "email" },
        // eslint-disable-next-line i18next/no-literal-string
        { header: t("course-instance"), accessorKey: "courseInstance" },
      ]}
      data={mockStudentsSorted}
    />
  )
}
