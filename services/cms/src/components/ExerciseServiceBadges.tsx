"use client"

import { css } from "@emotion/css"

import type { ExerciseServiceIframeRenderingInfo } from "@/generated/api"
import { Badge, type BadgeTone } from "@/shared-module/components"
import { useTranslation } from "@/utils/useCmsTranslation"

const GLOBAL_ADMIN_ONLY_TONE: BadgeTone = "neutral"
const EXPERIMENTAL_TONE: BadgeTone = "warning"

const badgesCss = css`
  display: inline-flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin-inline-start: var(--space-3);
  vertical-align: middle;
`

interface ExerciseServiceBadgesProps {
  exerciseService: Pick<
    ExerciseServiceIframeRenderingInfo,
    "is_global_admin_only" | "is_experimental"
  >
}

/** Tags for the admin-set flags of an exercise service; renders nothing when none is set. */
const ExerciseServiceBadges: React.FC<ExerciseServiceBadgesProps> = ({ exerciseService }) => {
  const { t } = useTranslation()
  if (!exerciseService.is_global_admin_only && !exerciseService.is_experimental) {
    return null
  }
  return (
    <span className={badgesCss}>
      {exerciseService.is_global_admin_only && (
        <Badge tone={GLOBAL_ADMIN_ONLY_TONE} size="compact">
          {t("label-global-admins-only")}
        </Badge>
      )}
      {exerciseService.is_experimental && (
        <Badge tone={EXPERIMENTAL_TONE} size="compact">
          {t("label-experimental")}
        </Badge>
      )}
    </span>
  )
}

export default ExerciseServiceBadges
