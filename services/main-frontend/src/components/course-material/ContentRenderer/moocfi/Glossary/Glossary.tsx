"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"
import { useTranslation } from "react-i18next"

import { getCourseMaterialGlossary } from "@/generated/course-material-api/sdk.generated"
import { respondToOrLarger } from "@/shared-module/common/styles/respond"
import { QueryResult } from "@/shared-module/components"

interface Props {
  courseId: string
}

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
    <div
      className={css`
        margin: 0 auto;
        a {
          text-decoration: none;
          color: #007bff;
          :hover {
            text-decoration: underline;
          }
        }
        ${respondToOrLarger.sm} {
          padding-top: 100px;
        }
      `}
    >
      <h1
        className={css`
          margin-bottom: 40px;
          text-transform: uppercase;
        `}
      >
        {t("glossary")}
      </h1>
      <table
        className={css`
          text-align: left;
          border-spacing: 5px;
          th {
            padding: 20px;
            background: #8fb4b1;
          }
          td {
            vertical-align: top;
            padding: 20px;
          }
          tr:nth-child(2n) {
            background: #1f696466;
          }
          tr:nth-child(2n + 1) {
            background: #1f696433;
          }
        `}
      >
        <thead>
          <tr>
            <th>{t("term")}</th>
            <th
              className={css`
                width: 100%;
              `}
            >
              {t("definition")}
            </th>
          </tr>
        </thead>
        <tbody>
          {data
            .sort((a, b) => a.term.toLowerCase().localeCompare(b.term.toLowerCase()))
            .map((t) => {
              return (
                <tr key={t.id}>
                  <td>{t.term}</td>
                  <td>{t.definition}</td>
                </tr>
              )
            })}
        </tbody>
      </table>
    </div>
  )

  return (
    <QueryResult query={glossary} treatEmptyAsData>
      {(data) => renderGlossary(data)}
    </QueryResult>
  )
}

export default Glossary
