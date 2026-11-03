"use client"

import { useMutation } from "@tanstack/react-query"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef } from "react"
import { useTranslation } from "react-i18next"

import { createAgentChangesetPreviewLinkMutation } from "@/generated/api/@tanstack/react-query.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { ErrorNotice, Spinner } from "@/shared-module/components"

/** Mints a preview link for a page in a changeset and forwards to it. */
function AgentChangesetPagePreviewPage() {
  const { t } = useTranslation()
  const params = useParams<{ changesetId: string; pageId: string }>()
  const router = useRouter()
  const previewLinkMutation = useMutation({
    ...createAgentChangesetPreviewLinkMutation(),
    onSuccess: (link) => router.replace(link.preview_path),
  })
  const { mutate } = previewLinkMutation
  // Strict mode runs effects twice; one preview link is enough.
  const requested = useRef(false)

  useEffect(() => {
    if (requested.current) {
      return
    }
    requested.current = true
    mutate({ path: { changeset_id: params.changesetId, page_id: params.pageId } })
  }, [mutate, params.changesetId, params.pageId])

  if (previewLinkMutation.isError) {
    return (
      <ErrorNotice
        error={previewLinkMutation.error}
        context={t("agent-open-preview-failed")}
        data-testid="agent-open-preview-error"
      />
    )
  }
  return <Spinner />
}

export default withErrorBoundary(withSignedIn(AgentChangesetPagePreviewPage))
