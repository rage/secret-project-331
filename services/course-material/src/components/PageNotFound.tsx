import { Alert, AlertTitle } from "@material-ui/lab"
import React from "react"
import { Trans, useTranslation } from "react-i18next"

import PublicPageList from "./PublicPageList"

interface PageNotFoundProps {
  path: string
  courseId: string
}

const PageNotFound: React.FC<PageNotFoundProps> = ({ path, courseId }) => {
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
          {<PublicPageList courseId={courseId} />}
        </>
      )}
    </>
  )
}

export default PageNotFound
