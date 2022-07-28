import React, { useContext } from "react"
import { useTranslation } from "react-i18next"

import PageContext from "../../../../contexts/PageContext"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

import Glossary from "./Glossary"

const GlossaryBlock: React.FC<React.PropsWithChildren<unknown>> = () => {
  const { t } = useTranslation()
  const pageContext = useContext(PageContext)

  if (pageContext.state !== "ready") {
    return <Spinner variant="small" />
  }

  if (pageContext.pageData.course_id === null) {
    return <ErrorBanner variant="readOnly" error={t("block-invalid-without-course")} />
  }

  return <Glossary courseId={pageContext.pageData.course_id} />
}

export default withErrorBoundary(GlossaryBlock)
