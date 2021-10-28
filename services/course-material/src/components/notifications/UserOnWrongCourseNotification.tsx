import { css } from "@emotion/css"
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
      <Link passHref href={`/${data.slug}`}>
        <a
          className={css`
            color: #000;
            text-decoration: none;
            &:hover {
              color: #333;
            }
          `}
          hrefLang={data.language_code}
          href="replace"
        >
          <Trans t={t} i18nKey="message-already-on-different-language-version">
            Looks like you&apos;re already on a different language version of this course. Before
            answering any exercises, please return to <b>{{ name: data.name }}</b>
            or change your active language in the settings.
          </Trans>
        </a>
      </Link>
    </Banner>
  )
}

export default UserOnWrongCourseNotification
