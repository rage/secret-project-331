import { css } from "@emotion/css"
import { InfoCircle } from "@vectopus/atlas-icons-react"
import Link from "next/link"
import React, { useContext, useMemo } from "react"
import { Trans, useTranslation } from "react-i18next"

import PageContext from "../../contexts/PageContext"
import { useCourseData } from "../../hooks/useCourseData"
import useLanguageNavigation from "../../hooks/useLanguageNavigation"

import Button from "@/shared-module/common/components/Button"
import BreakFromCentered from "@/shared-module/common/components/Centering/BreakFromCentered"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { baseTheme } from "@/shared-module/common/styles/theme"
import ietfLanguageTagToHumanReadableName from "@/shared-module/common/utils/ietfLanguageTagToHumanReadableName"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export interface CourseData {
  name: string
  language_code: string
  slug: string
}

const formatCourseName = (courseData: CourseData): string => {
  const languageHumanReadableName = ietfLanguageTagToHumanReadableName(courseData.language_code)
  return `${courseData.name} (${languageHumanReadableName})`
}

export interface UserOnWrongCourseNotificationProps {
  correctCourseId: string
  organizationSlug: string
  variant?: "compact" | "full"
}

const UserOnWrongCourseNotification: React.FC<
  React.PropsWithChildren<UserOnWrongCourseNotificationProps>
> = ({ correctCourseId, organizationSlug: _organizationSlug, variant = "full" }) => {
  const { t } = useTranslation()
  const pageState = useContext(PageContext)

  const getCourseById = useCourseData({ courseId: correctCourseId })

  // Use the correct course ID for language navigation
  const {
    availableLanguages,
    getLanguageUrl,
    isLoading: languageNavLoading,
    error: languageNavError,
  } = useLanguageNavigation({
    currentCourseId: correctCourseId,
    currentPageId: pageState.pageData?.id ?? null,
  })

  // Generate the target URL for the Link component using getLanguageUrl
  const targetUrl = useMemo(() => {
    if (!getCourseById.data) {
      return "#"
    }
    return getLanguageUrl(getCourseById.data.language_code) || "#"
  }, [getCourseById.data, getLanguageUrl])

  if (getCourseById.isError) {
    return <ErrorBanner variant={"readOnly"} error={getCourseById.error} />
  }

  if (languageNavError) {
    return <ErrorBanner variant={"readOnly"} error={new Error(languageNavError)} />
  }

  if (getCourseById.isPending || languageNavLoading) {
    return <Spinner variant={variant === "compact" ? "small" : "medium"} />
  }

  const courseData = getCourseById.data

  // Check if the target language is available for switching
  const targetLanguageAvailable = availableLanguages.some(
    (lang) => lang.code === courseData.language_code,
  )

  if (variant === "compact") {
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
            {targetLanguageAvailable ? (
              <Link href={targetUrl} hrefLang={courseData.language_code}>
                <Button variant="primary" size="medium" transform="none">
                  <Trans
                    i18nKey="go-to-your-language-version"
                    values={{
                      name: formatCourseName(courseData),
                    }}
                    components={{
                      courseName: <span lang={courseData.language_code} />,
                    }}
                  />
                </Button>
              </Link>
            ) : (
              <Button variant="primary" size="medium" transform="none" disabled={true}>
                <Trans
                  i18nKey="go-to-your-language-version"
                  values={{
                    name: formatCourseName(courseData),
                  }}
                  components={{
                    courseName: <span lang={courseData.language_code} />,
                  }}
                />
              </Button>
            )}
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
        {targetLanguageAvailable ? (
          <Link href={targetUrl} hrefLang={courseData.language_code}>
            <Button variant="primary" size="large" transform="none">
              <Trans
                i18nKey="go-to-your-language-version"
                values={{
                  name: formatCourseName(courseData),
                }}
                components={{
                  courseName: <span lang={courseData.language_code} />,
                }}
              />
            </Button>
          </Link>
        ) : (
          <Button variant="primary" size="large" transform="none" disabled={true}>
            <Trans
              i18nKey="go-to-your-language-version"
              values={{
                name: formatCourseName(courseData),
              }}
              components={{
                courseName: <span lang={courseData.language_code} />,
              }}
            />
          </Button>
        )}
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
