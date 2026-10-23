"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type { PublishOutcome } from "@/generated/api/types.generated"
import { Infobox, TONE } from "@/shared-module/components"

interface PublishOutcomeNoticeProps {
  outcome: PublishOutcome
}

/** What happened when the teacher pressed Publish: published, or why nothing was published. */
const PublishOutcomeNotice: React.FC<PublishOutcomeNoticeProps> = ({ outcome }) => {
  const { t } = useTranslation()

  if (outcome.outcome === "published") {
    return (
      <Infobox
        tone={TONE.SUCCESS}
        announce
        heading={t("agent-published-heading")}
        data-testid="agent-publish-outcome"
      >
        {outcome.redirects.length > 0 ? (
          <>
            <p>{t("agent-published-redirects")}</p>
            <ul>
              {outcome.redirects.map((redirect) => (
                <li key={`${redirect.page_id}-${redirect.old_url_path}`}>
                  {t("agent-redirect-from-to", {
                    from: redirect.old_url_path,
                    to: redirect.new_url_path,
                  })}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>{t("agent-published-description")}</p>
        )}
      </Infobox>
    )
  }

  const { rejection } = outcome
  switch (rejection.reason) {
    case "conflicts":
      return (
        <Infobox
          tone={TONE.DANGER}
          announce
          heading={t("agent-not-published-heading")}
          data-testid="agent-publish-outcome"
        >
          <p>{t("agent-not-published-conflicts")}</p>
          <ul>
            {rejection.conflicts.map((conflict) => (
              <li key={`${conflict.entity_type}-${conflict.entity_id}`}>{conflict.label}</li>
            ))}
          </ul>
        </Infobox>
      )
    case "needs_confirmation":
      return (
        <Infobox
          tone={TONE.DANGER}
          announce
          heading={t("agent-not-published-heading")}
          data-testid="agent-publish-outcome"
        >
          <p>{t("agent-not-published-needs-confirmation")}</p>
          <ul>
            {rejection.risky_entities.map((entity) => (
              <li key={`${entity.entity_type}-${entity.entity_id}`}>{entity.label}</li>
            ))}
          </ul>
        </Infobox>
      )
    case "global_admin_only_exercise_services":
      return (
        <Infobox
          tone={TONE.DANGER}
          announce
          heading={t("agent-not-published-heading")}
          data-testid="agent-publish-outcome"
        >
          <p>
            {t("agent-not-published-admin-only-services", {
              services: rejection.service_names.join(", "),
            })}
          </p>
        </Infobox>
      )
  }
}

export default PublishOutcomeNotice
