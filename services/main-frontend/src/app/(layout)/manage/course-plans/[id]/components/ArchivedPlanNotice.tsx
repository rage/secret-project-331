"use client"

import { css } from "@emotion/css"
import { useTranslation } from "react-i18next"

import { Button, Infobox, TONE } from "@/shared-module/components"

import { usePlanArchiveActions } from "../../hooks/usePlanArchiveActions"

const noticeStyles = css`
  margin-bottom: 1.5rem;
`

const bodyStyles = css`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;

  p {
    margin: 0;
  }
`

interface ArchivedPlanNoticeProps {
  planId: string
}

/** Tells members the plan is archived and offers to restore it. */
export default function ArchivedPlanNotice({ planId }: ArchivedPlanNoticeProps) {
  const { t } = useTranslation()
  const { restore, isPending } = usePlanArchiveActions(planId)

  return (
    <Infobox
      tone={TONE.NEUTRAL}
      heading={t("course-plans-archived-notice-title")}
      className={noticeStyles}
    >
      <div className={bodyStyles}>
        <p>{t("course-plans-archived-notice-body")}</p>
        <Button
          variant="secondary"
          size="small"
          onClick={() => void restore()}
          disabled={isPending}
        >
          {t("course-plans-restore-plan")}
        </Button>
      </div>
    </Infobox>
  )
}
