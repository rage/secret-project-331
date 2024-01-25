import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import React from "react"
import { Trans, useTranslation } from "react-i18next"

import { fetchCourseById } from "../../services/backend"
import Banner from "../../shared-module/common/components/Banner/Banner"
import BreakFromCentered from "../../shared-module/common/components/Centering/BreakFromCentered"
import ErrorBanner from "../../shared-module/common/components/ErrorBanner"
import Spinner from "../../shared-module/common/components/Spinner"
import ietfLanguageTagToHumanReadableName from "../../shared-module/common/utils/ietfLanguageTagToHumanReadableName"
import withErrorBoundary from "../../shared-module/common/utils/withErrorBoundary"

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
    return <ErrorBanner error={getCourseById.error} />
  }

  if (getCourseById.isPending) {
    return <Spinner variant={"medium"} />
  }
  const languageHumanReadableName = ietfLanguageTagToHumanReadableName(
    getCourseById.data.language_code,
  )
  const name = `${getCourseById.data.name} (${languageHumanReadableName})`

  return (
    <BreakFromCentered sidebar={false}>
      <Banner variant="readOnly">
        <Link
          href={`/${organizationSlug}/courses/${getCourseById.data.slug}`}
          className={css`
            color: #000;
            text-decoration: none;
            max-width: 900px;
            display: block;
            margin: 0 auto;
            &:hover {
              color: #333;
            }
          `}
          hrefLang={getCourseById.data.language_code}
        >
          <Trans t={t} i18nKey="message-already-on-different-language-version">
            Looks like you&apos;re already on a different language version of this course. Before
            answering any exercises, please return to <b>{{ name }}</b>
            or change your active language in the settings.
          </Trans>
        </Link>
      </Banner>
    </BreakFromCentered>
  )
}

export default withErrorBoundary(UserOnWrongCourseNotification)
