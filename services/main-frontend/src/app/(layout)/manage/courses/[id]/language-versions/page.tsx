"use client"

import { css } from "@emotion/css"
import { useParams } from "next/navigation"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import { TEACHER_MODE } from "@/components/language-versions/constants"
import { LanguageVersionTool } from "@/components/language-versions/LanguageVersionTool"
import { useCourseQuery } from "@/hooks/useCourseQuery"
import { useInvalidateLanguageVersions } from "@/hooks/useLanguageVersions"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { baseTheme, headingFont } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button } from "@/shared-module/components"

import NewCourseLanguageVersionDialog from "./NewCourseLanguageVersionDialog"

const headingCss = css`
  font-size: clamp(2rem, 3.6vh, 36px);
  color: ${baseTheme.colors.gray[700]};
  font-family: ${headingFont};
  font-weight: bold;
`

function LanguageVersionsPage() {
  const { t } = useTranslation()
  const params = useParams<{ id: string }>()
  const courseId = params.id
  const courseQuery = useCourseQuery(courseId)
  const invalidateLanguageVersions = useInvalidateLanguageVersions()
  const [isNewVersionOpen, setIsNewVersionOpen] = useState(false)
  const course = courseQuery.data

  return (
    <>
      <h1 className={headingCss}>{t("link-language-versions")}</h1>
      <LanguageVersionTool
        courseId={courseId}
        mode={TEACHER_MODE}
        extraCourseActions={
          <Button
            variant="secondary"
            size="medium"
            disabled={!course}
            onPress={() => setIsNewVersionOpen(true)}
          >
            {t("language-versions-new-language-version")}
          </Button>
        }
      />
      {course && isNewVersionOpen && (
        <NewCourseLanguageVersionDialog
          showNewLanguageVersionForm={isNewVersionOpen}
          courseName={course.name}
          organizationId={course.organization_id}
          courseId={courseId}
          onClose={() => setIsNewVersionOpen(false)}
          onSuccess={() => {
            setIsNewVersionOpen(false)
            void invalidateLanguageVersions()
          }}
        />
      )}
    </>
  )
}

export default withErrorBoundary(withSignedIn(LanguageVersionsPage))
