"use client"

import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import { useEffect } from "react"
import { useTranslation } from "react-i18next"

import StagedPageContent from "@/components/agent-changesets/StagedPageContent"
import { getAgentPagePreviewOptions } from "@/generated/api/@tanstack/react-query.generated"
import Centered from "@/shared-module/common/components/Centering/Centered"
import NoIndexMeta from "@/shared-module/common/components/NoIndexMeta"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import { baseTheme, fontWeights } from "@/shared-module/common/styles"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

/** A page as an AI agent staged it, for the agent's own visual checks. No login: the token is the key. */
function AgentPreviewPage() {
  const params = useParams<{ token: string }>()
  const { t, i18n } = useTranslation()
  const previewQuery = useQuery({
    ...getAgentPagePreviewOptions({ path: { token: params.token } }),
    retry: false,
  })
  usePageTitle(previewQuery.data?.page.title ?? null)

  const languageCode = previewQuery.data?.language_code
  useEffect(() => {
    if (languageCode) {
      i18n.changeLanguage(languageCode)
    }
  }, [i18n, languageCode])

  return (
    <>
      <NoIndexMeta noIndex />
      <header
        data-testid="agent-preview-banner"
        className={css`
          background: ${baseTheme.colors.gray[700]};
          color: ${baseTheme.colors.clear[100]};
          padding: 0.5rem 1rem;
          font-size: 0.875rem;
          text-align: center;
        `}
      >
        <h1
          className={css`
            display: inline;
            font-size: inherit;
            font-weight: ${fontWeights.semibold};
            margin: 0;
          `}
        >
          {t("agent-preview-banner")}
        </h1>{" "}
        {previewQuery.data &&
          t("agent-preview-banner-course", { course: previewQuery.data.course_name })}
      </header>
      <main
        className={css`
          padding: 2rem 0 4rem;
        `}
      >
        <Centered variant="narrow">
          <QueryResult query={previewQuery}>
            {(preview) => (
              <div id="content" data-testid="agent-preview-content">
                <StagedPageContent
                  page={preview.page}
                  isChapterFrontPage={preview.is_chapter_front_page}
                />
              </div>
            )}
          </QueryResult>
        </Centered>
      </main>
    </>
  )
}

export default withErrorBoundary(AgentPreviewPage)
