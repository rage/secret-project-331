"use client"

import React from "react"
import { useTranslation } from "react-i18next"

import { ErrorNotice } from "@/shared-module/components"

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
      <ErrorNotice
        error={new Error(`${t("404-not-found")} ${t("course-has-no-page-at-path", { path })}`)}
      />
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
