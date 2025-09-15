import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { InfoCircle } from "@vectopus/atlas-icons-react"
import Link from "next/link"
import React from "react"
import { useTranslation } from "react-i18next"

import { fetchCourseById } from "../../services/backend"

import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles/theme"
import ietfLanguageTagToHumanReadableName from "@/shared-module/common/utils/ietfLanguageTagToHumanReadableName"
import { navigateToCourseRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export interface CompactUserOnWrongCourseNotificationProps {
  correctCourseId: string
  organizationSlug: string
}

const CompactUserOnWrongCourseNotification: React.FC<
  React.PropsWithChildren<CompactUserOnWrongCourseNotificationProps>
> = ({ correctCourseId, organizationSlug }) => {
  const { t } = useTranslation()
  const getCourseById = useQuery({
    queryKey: [`correct-course-${correctCourseId}`],
    queryFn: () => fetchCourseById(correctCourseId),
  })

  if (getCourseById.isError) {
    return <ErrorBanner variant={"readOnly"} error={getCourseById.error} />
  }

  if (getCourseById.isPending) {
    return <Spinner variant={"small"} />
  }

  const languageHumanReadableName = ietfLanguageTagToHumanReadableName(
    getCourseById.data.language_code,
  )
  const name = `${getCourseById.data.name} (${languageHumanReadableName})`
  const courseUrl = navigateToCourseRoute(organizationSlug, getCourseById.data.slug)

  return (
    <div
      className={css`
        display: flex;
        align-items: center;
        gap: 0.7rem;
        background: ${baseTheme.colors.yellow[100]};
        border-left: 4px solid ${baseTheme.colors.crimson[400]};
        padding: 0.7rem 1.1rem;
        border-radius: 5px;
        font-size: 1rem;
        margin: 0.5rem 0;
      `}
    >
      <span
        className={css`
          display: flex;
          align-items: center;
          font-size: 1.3rem;
        `}
        aria-hidden="true"
      >
        <InfoCircle
          className={css`
            width: 1.5rem;
            height: 1.5rem;
            color: ${baseTheme.colors.green[600]};
            flex-shrink: 0;
          `}
        />
      </span>
      <span>
        {t("already-started-course-in-different-language-title")}
        <Link
          href={courseUrl}
          className={css`
            color: ${baseTheme.colors.green[700]};
            font-weight: 600;
            text-decoration: underline;
            margin-left: 0.2rem;
            &:hover,
            &:focus {
              color: ${baseTheme.colors.green[700]};
            }
          `}
          hrefLang={getCourseById.data.language_code}
        >
          {t("go-to-your-language-version", { name })}
        </Link>
      </span>
    </div>
  )
}

export default withErrorBoundary(CompactUserOnWrongCourseNotification)
