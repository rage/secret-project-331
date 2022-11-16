import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import React from "react"
import { Trans, useTranslation } from "react-i18next"

import { fetchCourseById } from "../../services/backend"
import Banner from "../../shared-module/components/Banner/Banner"
import BreakFromCentered from "../../shared-module/components/Centering/BreakFromCentered"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import Spinner from "../../shared-module/components/Spinner"

export interface UserOnWrongCourseNotificationProps {
  correctCourseId: string
  organizationSlug: string
}

const UserOnWrongCourseNotification: React.FC<
  React.PropsWithChildren<UserOnWrongCourseNotificationProps>
> = ({ correctCourseId, organizationSlug }) => {
  const { t } = useTranslation()
  const getCourseById = useQuery([`correct-course-${correctCourseId}`], () =>
    fetchCourseById(correctCourseId),
  )

  if (getCourseById.isError) {
    return <ErrorBanner variant={"readOnly"} error={getCourseById.error} />
  }

  if (getCourseById.isLoading) {
    return <Spinner variant={"medium"} />
  }

  return (
    <BreakFromCentered sidebar={false}>
      <Banner variant="readOnly">
        <Link passHref href={`/${organizationSlug}/courses/${getCourseById.data.slug}`}>
          <a
            className={css`
              color: #000;
              text-decoration: none;
              &:hover {
                color: #333;
              }
            `}
            hrefLang={getCourseById.data.language_code}
          >
            <Trans t={t} i18nKey="message-already-on-different-language-version">
              Looks like you&apos;re already on a different language version of this course. Before
              answering any exercises, please return to <b>{{ name: getCourseById.data.name }}</b>
              or change your active language in the settings.
            </Trans>
          </a>
        </Link>
      </Banner>
    </BreakFromCentered>
  )
}

export default UserOnWrongCourseNotification
