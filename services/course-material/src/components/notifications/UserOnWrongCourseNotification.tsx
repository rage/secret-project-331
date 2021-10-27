import Link from "next/link"
import React from "react"
import { Trans, useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import { fetchCourseById } from "../../services/backend"
import Banner from "../../shared-module/components/Banner/Banner"
import GenericLoading from "../GenericLoading"

export interface UserOnWrongCourseNotificationProps {
  correctCourseId: string
}

const UserOnWrongCourseNotification: React.FC<UserOnWrongCourseNotificationProps> = ({
  correctCourseId,
}) => {
  const { t } = useTranslation()
  const { isLoading, error, data } = useQuery(`correct-course-${correctCourseId}`, () =>
    fetchCourseById(correctCourseId),
  )

  if (error) {
    return <pre>{JSON.stringify(error, undefined, 2)}</pre>
  }

  if (isLoading || !data) {
    return <GenericLoading />
  }

  return (
    <Banner variant="readOnly">
      <Trans t={t} i18nKey="message-already-on-different-language-version">
        Looks like you&apos;re already on a different language version of this course. Before
        answering any exercises, please return to{" "}
        <Link passHref href={{ pathname: "/[courseSlug]", query: { courseSlug: data.slug } }}>
          <a hrefLang={data.language_code} href="replace">
            {{ name: data.name }}
          </a>
        </Link>{" "}
        or change your active language in the settings.
      </Trans>
    </Banner>
  )
}

export default UserOnWrongCourseNotification
