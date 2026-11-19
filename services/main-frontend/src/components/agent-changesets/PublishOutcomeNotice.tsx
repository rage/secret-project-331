"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import type {
  DiscardRejection,
  EntityRef,
  PublishBlocker,
  PublishOutcome,
  PublishRejection,
} from "@/generated/api/types.generated"
import { Infobox, type InfoboxTone, TONE } from "@/shared-module/components"

import { ChangesetStatusBadge } from "./ChangesetStatusBadge"
import { ConflictList, EntityLabelList, useEntityTypeLabel } from "./EntityChange"
import { useEntityName } from "./useEntityName"

/** The rules of publishing that the course would break, in words a teacher reads. */
const BlockerList: React.FC<{ blockers: PublishBlocker[] }> = ({ blockers }) => {
  const { t } = useTranslation()
  const entityName = useEntityName()
  const names = (entities: EntityRef[]) => entities.map((entity) => entityName(entity)).join(", ")

  const blockerText = (blocker: PublishBlocker): string => {
    switch (blocker.kind) {
      case "page_in_missing_chapter":
        return t("agent-blocker-page-in-missing-chapter", { page: entityName(blocker.page) })
      case "duplicate_path":
        return t("agent-blocker-duplicate-path", {
          pages: names(blocker.pages),
          urlPath: blocker.url_path,
        })
      case "duplicate_page_order_number":
        return blocker.chapter
          ? t("agent-blocker-duplicate-page-order-number", {
              pages: names(blocker.pages),
              chapter: entityName(blocker.chapter),
              position: blocker.order_number,
            })
          : t("agent-blocker-duplicate-page-order-number-outside-chapters", {
              pages: names(blocker.pages),
              position: blocker.order_number,
            })
      case "chapter_in_missing_module":
        return t("agent-blocker-chapter-in-missing-module", {
          chapter: entityName(blocker.chapter),
        })
      case "missing_front_page":
        return t("agent-blocker-missing-front-page", { chapter: entityName(blocker.chapter) })
      case "front_page_in_other_chapter":
        return t("agent-blocker-front-page-in-other-chapter", {
          chapter: entityName(blocker.chapter),
          page: entityName(blocker.front_page),
        })
      case "front_page_off_path":
        return t("agent-blocker-front-page-off-path", {
          chapter: entityName(blocker.chapter),
          page: entityName(blocker.front_page),
          urlPath: blocker.url_path,
          expectedUrlPath: blocker.expected_url_path,
        })
      case "duplicate_chapter_number":
        return t("agent-blocker-duplicate-chapter-number", {
          chapters: names(blocker.chapters),
          number: blocker.chapter_number,
        })
      case "duplicate_module_order_number":
        return t("agent-blocker-duplicate-module-order-number", {
          modules: names(blocker.modules),
          position: blocker.order_number,
        })
    }
  }

  return (
    <ul>
      {blockers.map((blocker) => (
        <li key={JSON.stringify(blocker)}>{blockerText(blocker)}</li>
      ))}
    </ul>
  )
}

const listNotice = (intro: string, list: React.ReactNode) => ({
  tone: TONE.DANGER,
  body: (
    <>
      <p>{intro}</p>
      {list}
    </>
  ),
})

interface RejectionNoticeProps {
  heading: string
  rejection: PublishRejection | DiscardRejection
  "data-testid": string
}

/** Why a publish or discard changed nothing. */
export const RejectionNotice: React.FC<RejectionNoticeProps> = ({
  heading,
  rejection,
  "data-testid": testId,
}) => {
  const { t } = useTranslation()
  const entityTypeLabel = useEntityTypeLabel()
  const entityName = useEntityName()

  const notice = (): { tone: InfoboxTone; body: React.ReactNode } => {
    switch (rejection.reason) {
      case "changed_since_review":
        return { tone: TONE.WARNING, body: <p>{t("agent-rejection-changed-since-review")}</p> }
      case "not_open":
        return {
          tone: TONE.WARNING,
          body: (
            <p>
              {t("agent-rejection-not-open")} <ChangesetStatusBadge status={rejection.status} />
            </p>
          ),
        }
      case "conflicts":
        return listNotice(
          t("agent-not-published-conflicts"),
          <ConflictList conflicts={rejection.conflicts} />,
        )
      case "needs_confirmation":
        return listNotice(
          t("agent-not-published-needs-confirmation"),
          <EntityLabelList entities={rejection.risky_entities} />,
        )
      case "blockers":
        return listNotice(
          t("agent-rejection-blockers"),
          <BlockerList blockers={rejection.blockers} />,
        )
      case "global_admin_only_exercise_services":
        return {
          tone: TONE.DANGER,
          body: (
            <p>
              {t("agent-not-published-admin-only-services", {
                services: rejection.service_names.join(", "),
              })}
            </p>
          ),
        }
      case "save_failed": {
        const { entity, message } = rejection
        return {
          tone: TONE.DANGER,
          body: (
            <>
              <p>
                {entity
                  ? t("agent-not-published-save-failed-entity", {
                      entity: `${entityName(entity)} (${entityTypeLabel(entity)})`,
                    })
                  : t("agent-not-published-save-failed")}
              </p>
              <p lang="en">{message}</p>
            </>
          ),
        }
      }
    }
  }

  const { tone, body } = notice()
  return (
    <Infobox tone={tone} announce heading={heading} data-testid={testId}>
      {body}
    </Infobox>
  )
}

interface PublishOutcomeNoticeProps {
  outcome: PublishOutcome
}

/** What happened when the teacher pressed Publish: published, or why nothing was published. */
const PublishOutcomeNotice: React.FC<PublishOutcomeNoticeProps> = ({ outcome }) => {
  const { t } = useTranslation()

  if (outcome.outcome === "rejected") {
    return (
      <RejectionNotice
        heading={t("agent-not-published-heading")}
        rejection={outcome.rejection}
        data-testid="agent-publish-outcome"
      />
    )
  }
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

export default PublishOutcomeNotice
