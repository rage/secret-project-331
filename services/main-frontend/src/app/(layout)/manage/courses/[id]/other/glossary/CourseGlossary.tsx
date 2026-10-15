"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import type { CourseManagementPagesProps } from "@/app/(layout)/manage/courses/[id]/types"
import { getCourseGlossaryOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { Term as GlossaryTerm } from "@/generated/api/types.generated"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import { QueryResult } from "@/shared-module/components"

import CreateTermForm from "./CreateTermForm"
import TermItem from "./TermItem"

const pageCss = css`
  display: grid;
  gap: var(--space-5);
`

const listCss = css`
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;

  > li {
    padding-block: var(--space-4);
    border-top: 1px solid var(--color-clear-300);
  }

  > li:first-of-type {
    padding-top: 0;
    border-top: none;
  }
`

const CourseGlossary: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()

  const [editingTerm, setEditingTerm] = useState<string | null>(null)
  const glossary = useQuery(
    getCourseGlossaryOptions({
      path: {
        course_id: courseId,
      },
    }),
  )

  return (
    <div className={pageCss}>
      <h1
        className={css`
          font-size: clamp(2rem, 3.6vh, 36px);
          color: ${baseTheme.colors.gray[700]};
          font-family: ${headingFont};
          font-weight: bold;
        `}
      >
        {t("manage-glossary")}
      </h1>
      <CreateTermForm refetch={glossary.refetch} courseId={courseId} />
      <QueryResult query={glossary}>
        {(data) => (
          <ul className={listCss}>
            {[...data]
              .toSorted((a: GlossaryTerm, b: GlossaryTerm) => a.term.localeCompare(b.term))
              .map((term: GlossaryTerm) => (
                <TermItem
                  key={term.id}
                  term={term}
                  isEditing={editingTerm === term.id}
                  onEdit={() => {
                    setEditingTerm(term.id)
                  }}
                  onCancel={() => setEditingTerm(null)}
                  refetch={glossary.refetch}
                />
              ))}
          </ul>
        )}
      </QueryResult>
    </div>
  )
}

export default CourseGlossary
