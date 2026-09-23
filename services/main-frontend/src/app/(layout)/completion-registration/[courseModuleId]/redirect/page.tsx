"use client"

import { useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useEffect } from "react"
import { Trans, useTranslation } from "react-i18next"

import { TONE } from "@/components/credit-registration/constants"
import { narrowPageCss, pageTitleCss } from "@/components/credit-registration/styles"
import { getCourseModuleCompletionRegistrationLinkOptions } from "@/generated/api/@tanstack/react-query.generated"
import { isAppApiError } from "@/shared-module/common/errors/AppApiError"
import { usePageTitle } from "@/shared-module/common/hooks/usePageTitle"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Infobox, QueryResult } from "@/shared-module/components"

const NOT_FOUND = 404

const CompletionRedirectPage: React.FC = () => {
  const { courseModuleId } = useParams<{ courseModuleId: string }>()
  const { t } = useTranslation()
  usePageTitle(t("title-completion-registration-redirect"))
  const userCompletionInformation = useQuery(
    getCourseModuleCompletionRegistrationLinkOptions({
      path: {
        course_module_id: courseModuleId,
      },
    }),
  )

  useEffect(() => {
    if (!userCompletionInformation.data) {
      return
    }
    window.location.replace(userCompletionInformation.data.url)
  }, [userCompletionInformation.data])

  return (
    <div className={narrowPageCss}>
      <h1 className={pageTitleCss}>{t("title-completion-registration-redirect")}</h1>
      <QueryResult
        query={userCompletionInformation}
        renderBlockingError={({ error }) => (
          <Infobox tone={TONE.WARNING}>
            {isAppApiError(error) && error.status === NOT_FOUND
              ? t("completion-registration-link-not-found")
              : t("could-not-open-the-registration-form")}
          </Infobox>
        )}
      >
        {(data) => (
          <p>
            <Trans
              t={t}
              i18nKey="you-are-being-redirected-to-completion-registration-page-if-nothing-happens-click-here"
              components={{
                // oxlint-disable-next-line jsx-a11y/anchor-has-content, jsx-a11y/control-has-associated-label -- link content provided by <Trans> translation string
                redirectLink: <a href={data.url} />,
              }}
            />
          </p>
        )}
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(CompletionRedirectPage)
