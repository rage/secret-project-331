"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { pageTitleCss } from "@/components/credit-registration/styles"
import { getCourseMaterialGlossary } from "@/generated/course-material-api/sdk.generated"
import { QueryResult, Table } from "@/shared-module/components"

interface Props {
  courseId: string
}

const rootCss = css`
  display: grid;
  gap: var(--space-4);
  margin: 0 auto;
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
      <h1 className={pageTitleCss}>{t("glossary")}</h1>
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
