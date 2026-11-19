"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React from "react"

import { getCmsPagePendingAgentChangesOptions } from "@/generated/api/@tanstack/react-query.generated"
import { manageCourseAgentChangesetRoute } from "@/shared-module/common/utils/routes"
import { Infobox, Link, TONE } from "@/shared-module/components"
import { useTranslation } from "@/utils/useCmsTranslation"

interface PendingAgentChangesNoticeProps {
  pageId: string
}

/** Tells the teacher that their AI agent has staged changes to this page that are not live yet. */
const PendingAgentChangesNotice: React.FC<PendingAgentChangesNoticeProps> = ({ pageId }) => {
  const { t } = useTranslation()
  const pendingQuery = useQuery(getCmsPagePendingAgentChangesOptions({ path: { page_id: pageId } }))
  const changeset = pendingQuery.data
  if (!changeset) {
    return null
  }
  return (
    <Infobox
      tone={TONE.INFO}
      data-testid="pending-agent-changes-notice"
      className={css`
        margin-bottom: 1rem;
      `}
    >
      {t("pending-agent-changes-notice")}{" "}
      <Link
        href={manageCourseAgentChangesetRoute(changeset.course_id, changeset.id)}
        isCrossService
      >
        {t("review-agent-changes")}
      </Link>
    </Infobox>
  )
}

export default PendingAgentChangesNotice
