import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { InfoCircle } from "@vectopus/atlas-icons-react"
import Link from "next/link"
import { env } from "process"
import React from "react"
import { useTranslation } from "react-i18next"

import { fetchCourseById } from "../../services/backend"

import Button from "@/shared-module/common/components/Button"
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
  let courseUrl = navigateToCourseRoute(organizationSlug, getCourseById.data.slug)

  // Account for base path that next/link adds
  courseUrl = courseUrl.replace(
    // eslint-disable-next-line i18next/no-literal-string
    "/org",
    "",
  )

  return (
    <div
      className={css`
        display: flex;
        align-items: center;
        gap: 0.7rem;
        background: ${baseTheme.colors.yellow[100]};
        border: 1px solid ${baseTheme.colors.yellow[300]};
        padding: 1rem 1.2rem;
        border-radius: 1rem;
        font-size: 1rem;
        margin: 1rem 0;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
      `}
    >
      <div
        className={css`
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        `}
      >
        <div
          className={css`
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-weight: 600;
            color: ${baseTheme.colors.gray[700]};
            font-size: 1rem;
            line-height: 1.3;
          `}
        >
          <InfoCircle
            className={css`
              width: 1.2rem;
              height: 1.2rem;
              color: ${baseTheme.colors.blue[600]};
              flex-shrink: 0;
            `}
          />
          {t("already-started-course-in-different-language-title")}
        </div>
        <div
          className={css`
            font-size: 0.9rem;
            color: ${baseTheme.colors.gray[600]};
            line-height: 1.4;
            margin-bottom: 0.3rem;
          `}
        >
          {t("already-started-course-in-different-language-description")}
        </div>
        <div
          className={css`
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            align-items: flex-start;
          `}
        >
          <Link href={courseUrl} hrefLang={getCourseById.data.language_code}>
            <Button variant="primary" size="medium" transform="none">
              {t("go-to-your-language-version", { name })}
            </Button>
          </Link>
          <div
            className={css`
              font-size: 0.8rem;
              color: ${baseTheme.colors.gray[500]};
              line-height: 1.3;
            `}
          >
            {t("or-switch-language-in-settings")}
          </div>
        </div>
      </div>
    </div>
  )
}

export default withErrorBoundary(CompactUserOnWrongCourseNotification)
