"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { AgentChangesetStatus } from "@/generated/api/types.generated"
import { Badge, TONE } from "@/shared-module/components"

/** A changeset's status in words a teacher reads. */
export const ChangesetStatusBadge: React.FC<{ status: AgentChangesetStatus }> = ({ status }) => {
  const { t } = useTranslation()
  switch (status) {
    case "open":
      return <Badge tone={TONE.INFO}>{t("agent-changeset-status-open")}</Badge>
    case "published":
      return <Badge tone={TONE.SUCCESS}>{t("agent-changeset-status-published")}</Badge>
    case "discarded":
      return <Badge tone={TONE.NEUTRAL}>{t("agent-changeset-status-discarded")}</Badge>
    case "expired":
      return <Badge tone={TONE.NEUTRAL}>{t("agent-changeset-status-expired")}</Badge>
  }
}
