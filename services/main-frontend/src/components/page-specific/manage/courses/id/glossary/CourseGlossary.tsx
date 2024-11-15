import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { CourseManagementPagesProps } from "../../../../../../pages/manage/courses/[id]/[...path]"
import { fetchGlossary } from "../../../../../../services/backend/courses"

import CreateTermForm from "./CreateTermForm"
import TermItem from "./TermItem"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme, headingFont } from "@/shared-module/common/styles"

interface GlossaryTerm {
  id: string
  term: string
  definition: string
}

const CourseGlossary: React.FC<React.PropsWithChildren<CourseManagementPagesProps>> = ({
  courseId,
}) => {
  const { t } = useTranslation()

  const [editingTerm, setEditingTerm] = useState<string | null>(null)
  const glossary = useQuery({
    queryKey: [`glossary-${courseId}`],
    queryFn: () => fetchGlossary(courseId),
  })

  return (
    <>
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
      {glossary.isError && <ErrorBanner variant={"readOnly"} error={glossary.error} />}
      {glossary.isPending && <Spinner variant={"medium"} />}
      <CreateTermForm refetch={glossary.refetch} courseId={courseId} />
      {glossary.isSuccess &&
        glossary.data
          .sort((a: GlossaryTerm, b: GlossaryTerm) => a.term.localeCompare(b.term))
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
    </>
  )
}

export default CourseGlossary
