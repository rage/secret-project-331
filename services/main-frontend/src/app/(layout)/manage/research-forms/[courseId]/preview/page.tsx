"use client"

import { css } from "@emotion/css"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import SelectResearchConsentForm from "@/components/course-material/forms/SelectResearchConsentForm"
import useResearchConsentForm from "@/hooks/course-material/useResearchConsentForm"
import { useCourseQuery } from "@/hooks/useCourseQuery"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import type { ResearchFormPreviewMessage } from "@/shared-module/common/utils/researchFormPreview"
import { openResearchFormPreviewChannel } from "@/shared-module/common/utils/researchFormPreview"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, ErrorNotice, LoadingRegion } from "@/shared-module/components"

/** Shows the saved form until an open CMS editor sends its unsaved draft. */
function ResearchFormPreviewPage() {
  const params = useParams<{ courseId: string }>()
  const courseId = params.courseId
  const { t } = useTranslation()
  const courseQuery = useCourseQuery(courseId)
  const savedFormQuery = useResearchConsentForm(courseId)
  const [draftContent, setDraftContent] = useState<unknown>(undefined)
  const [isDialogOpen, setIsDialogOpen] = useState(true)
  usePageTitle(t("research-form-preview-heading"))

  useEffect(() => {
    const channel = openResearchFormPreviewChannel(courseId)
    channel.addEventListener("message", (event: MessageEvent<ResearchFormPreviewMessage>) => {
      if (event.data.type === "draft") {
        setDraftContent(event.data.content)
      }
    })
    // oxlint-disable-next-line unicorn/require-post-message-target-origin -- BroadcastChannel has no target origin
    channel.postMessage({ type: "ready" } satisfies ResearchFormPreviewMessage)
    return () => channel.close()
  }, [courseId])

  if (courseQuery.isError || savedFormQuery.isError) {
    return <ErrorNotice error={courseQuery.error ?? savedFormQuery.error} />
  }
  if (!courseQuery.data || !savedFormQuery.isSuccess) {
    return <LoadingRegion />
  }

  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        gap: var(--space-4);
      `}
    >
      <h1>{t("research-form-preview-heading")}</h1>
      <p>{t("research-form-preview-explanation")}</p>
      <Button variant="secondary" size="medium" onClick={() => setIsDialogOpen(true)}>
        {t("button-text-show-form-again")}
      </Button>
      {isDialogOpen && (
        <SelectResearchConsentForm
          editForm={false}
          shouldAnswerResearchForm={true}
          onClose={() => setIsDialogOpen(false)}
          content={draftContent ?? savedFormQuery.data?.content ?? []}
          preview={{ courseName: courseQuery.data.name }}
        />
      )}
    </div>
  )
}

export default withErrorBoundary(withSignedIn(ResearchFormPreviewPage))
