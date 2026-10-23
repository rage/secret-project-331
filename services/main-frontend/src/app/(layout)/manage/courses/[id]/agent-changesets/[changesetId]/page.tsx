"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useTranslation } from "react-i18next"

import ChangesetReview from "@/components/agent-changesets/ChangesetReview"
import { getAgentChangesetOptions } from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import { manageCourseAgentChangesetsRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Link, QueryResult } from "@/shared-module/components"

function AgentChangesetReviewPage() {
  const params = useParams<{ id: string; changesetId: string }>()
  const { t } = useTranslation()
  const reviewQuery = useQuery({
    ...getAgentChangesetOptions({ path: { changeset_id: params.changesetId } }),
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
      <QueryResult query={reviewQuery}>
        {(review) => <ChangesetReview review={review} />}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(AgentChangesetReviewPage))
