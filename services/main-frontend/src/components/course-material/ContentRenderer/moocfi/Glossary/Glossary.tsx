"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { getCourseMaterialGlossary } from "@/generated/course-material-api/sdk.generated"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { QueryResult, Table } from "@/shared-module/components"

interface Props {
  courseId: string
}

const rootCss = css`
  margin: 0 auto;

  ${respondToOrLarger.sm} {
    padding-top: 100px;
  }
`

const Glossary: React.FC<React.PropsWithChildren<Props>> = ({ courseId }) => {
  const { t } = useTranslation()

  const glossary = useQuery({
    queryKey: [`glossary-${courseId}`],
    queryFn: () =>
      getCourseMaterialGlossary({
        path: {
          course_id: courseId,
        },
      }),
  })

  const renderGlossary = (data: NonNullable<typeof glossary.data>) => (
    <div className={rootCss}>
      <h1>{t("glossary")}</h1>
      <Table
        caption={t("glossary")}
        rows={data.toSorted((a, b) => a.term.toLowerCase().localeCompare(b.term.toLowerCase()))}
        rowKey={(entry) => entry.id}
        columns={[
          {
            header: t("term"),
            minWidth: "8rem",
            cell: (entry) => entry.term,
          },
          {
            header: t("definition"),
            grow: 1,
            cell: (entry) => entry.definition,
          },
        ]}
      />
    </div>
  )

  return (
    <QueryResult query={glossary} treatEmptyAsData>
      {(data) => renderGlossary(data)}
    </QueryResult>
  )
}

export default Glossary
