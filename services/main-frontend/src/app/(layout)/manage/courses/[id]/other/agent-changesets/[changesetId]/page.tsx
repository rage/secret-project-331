"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useState } from "react"
import { useTranslation } from "react-i18next"

import ChangesetReview from "@/components/agent-changesets/ChangesetReview"
import { getAgentChangesetOptions } from "@/generated/api/@tanstack/react-query.generated"
import type { ChangesetReview as ChangesetReviewData } from "@/generated/api/types.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { manageCourseAgentChangesetsRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button, Infobox, Link, QueryResult, TONE } from "@/shared-module/components"

const REFETCH_INTERVAL_MS = 30_000

function AgentChangesetReviewPage() {
  const params = useParams<{ id: string; changesetId: string }>()
  const { t } = useTranslation()
  const reviewQuery = useQuery({
    ...getAgentChangesetOptions({ path: { changeset_id: params.changesetId } }),
    refetchInterval: (query) =>
      query.state.data?.changeset.status === "open" ? REFETCH_INTERVAL_MS : false,
  })
  return (
    <div
      className={css`
        display: flex;
        flex-direction: column;
        gap: 1rem;
      `}
    >
      <Link href={manageCourseAgentChangesetsRoute(params.id)}>
        {t("agent-all-changesets-link")}
      </Link>
      <QueryResult query={reviewQuery}>{(review) => <ShownReview latest={review} />}</QueryResult>
    </div>
  )
}

/** Publishing approves the revision on screen, so newly staged changes wait until the teacher
 * chooses to see them. */
function ShownReview({ latest }: { latest: ChangesetReviewData }) {
  const { t } = useTranslation()
  const [shown, setShown] = useState(latest)
  const hasNewChanges =
    latest.changeset.status === "open" && latest.changeset.revision !== shown.changeset.revision
  if (!hasNewChanges && shown !== latest) {
    setShown(latest)
  }

  return (
    <>
      {hasNewChanges && (
        <Infobox tone={TONE.INFO} announce data-testid="agent-changeset-new-changes">
          {t("agent-changeset-new-changes")}{" "}
          <Button variant="secondary" size="small" onPress={() => setShown(latest)}>
            {t("agent-changeset-show-new-changes")}
          </Button>
        </Infobox>
      )}
      <ChangesetReview review={shown} />
    </>
  )
}

export default withErrorBoundary(withSignedIn(AgentChangesetReviewPage))
