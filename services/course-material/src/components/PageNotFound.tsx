import { Alert, AlertTitle } from "@mui/lab"
import React from "react"
import { Trans, useTranslation } from "react-i18next"

import PublicPageList from "./PublicPageList"

interface PageNotFoundProps {
  path: string
  courseId: string
  organizationSlug: string
}

const PageNotFound: React.FC<React.PropsWithChildren<PageNotFoundProps>> = ({
  path,
  courseId,
  organizationSlug,
}) => {
  const { t } = useTranslation()
  return (
    <>
      <Alert severity="error">
        <AlertTitle>{t("404-not-found")}</AlertTitle>
        <Trans t={t} i18nKey="course-has-no-page-at-path">
          This course has no page at <code>{{ path }}</code>.
        </Trans>
      </Alert>
      {path === "/" && (
        <>
          <p>{t("if-author-of-course-please-create-front-page")}</p>
          {<PublicPageList courseId={courseId} organizationSlug={organizationSlug} />}
        </>
      )}
    </>
  )
}

export default PageNotFound
