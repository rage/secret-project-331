import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import { InfoCircle } from "@vectopus/atlas-icons-react"
import Link from "next/link"
import { env } from "process"
import React from "react"
import { useTranslation } from "react-i18next"

import { fetchCourseById } from "../../services/backend"

import Button from "@/shared-module/common/components/Button"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles/theme"
import ietfLanguageTagToHumanReadableName from "@/shared-module/common/utils/ietfLanguageTagToHumanReadableName"
import { navigateToCourseRoute } from "@/shared-module/common/utils/routes"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export interface UserOnWrongCourseNotificationProps {
  correctCourseId: string
  organizationSlug: string
}

const UserOnWrongCourseNotification: React.FC<
  React.PropsWithChildren<UserOnWrongCourseNotificationProps>
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
    return <Spinner variant={"medium"} />
  }

  const languageHumanReadableName = ietfLanguageTagToHumanReadableName(
    getCourseById.data.language_code,
  )
  const name = `${getCourseById.data.name} (${languageHumanReadableName})`

  // Account for base path that next/link adds
  let courseUrl = navigateToCourseRoute(organizationSlug, getCourseById.data.slug).replace(
    // eslint-disable-next-line i18next/no-literal-string
    "/org",
    "",
  )

  return (
    <BreakFromCentered sidebar={false}>
      <div
        className={css`
          background: linear-gradient(
            90deg,
            ${baseTheme.colors.yellow[100]} 0%,
            ${baseTheme.colors.crimson[100]} 100%
          );
          box-shadow: 0 2px 12px rgba(229, 57, 53, 0.08);
          padding: 2.5rem 2rem;
          margin: 2rem 0;
          text-align: center;
        `}
      >
        <div
          className={css`
            font-size: 1.3rem;
            font-weight: 700;
            color: ${baseTheme.colors.gray[700]};
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
          `}
        >
          <span
            className={css`
              display: flex;
              align-items: center;
              font-size: 2rem;
              vertical-align: middle;
            `}
            aria-hidden="true"
          >
            <InfoCircle
              className={css`
                width: 2.2rem;
                height: 2.2rem;
                color: ${baseTheme.colors.gray[700]};
                flex-shrink: 0;
              `}
            />
          </span>
          {t("already-started-course-in-different-language-title")}
        </div>
        <div
          className={css`
            font-size: 1.1rem;
            color: ${baseTheme.colors.gray[700]};
            margin-bottom: 2rem;
            max-width: 600px;
            margin-left: auto;
            margin-right: auto;
          `}
        >
          {t("already-started-course-in-different-language-description")}
        </div>
        <Link href={courseUrl} hrefLang={getCourseById.data.language_code}>
          <Button variant="primary" size="large" transform="none">
            {t("go-to-your-language-version", { name })}
          </Button>
        </Link>
        <div
          className={css`
            margin-top: 1.2rem;
            font-size: 0.98rem;
            color: ${baseTheme.colors.gray[600]};
          `}
        >
          {t("or-switch-language-in-settings")}
        </div>
      </div>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(UserOnWrongCourseNotification)
