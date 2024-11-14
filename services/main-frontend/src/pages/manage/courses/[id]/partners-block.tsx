import { css } from "@emotion/css"
import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import NewEmailTemplateForm from "../../../../components/page-specific/manage/course-instances/id/emails/NewEmailTemplateForm"
import {
  fetchCourseInstanceEmailTemplates,
  postNewEmailTemplateForCourseInstance,
} from "../../../../services/backend/course-instances"
import { deleteEmailTemplate } from "../../../../services/backend/email-templates"

import Button from "@/shared-module/common/components/Button"
import Dialog from "@/shared-module/common/components/Dialog"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

export interface CoursePartnersBlockProps {
  query: SimplifiedUrlQuery<"id">
}

const CoursePartnersBlock: React.FC<React.PropsWithChildren<CoursePartnersBlockProps>> = ({
  query,
}) => {
  // const { t } = useTranslation()
  // const courseInstanceId = query.id
  // const getCourseInstanceEmailTemplates = useQuery({
  //   queryKey: [`course-instance-${courseInstanceId}-emails`],
  //   queryFn: () => fetchCourseInstanceEmailTemplates(courseInstanceId),
  // })
  // const [showForm, setShowForm] = useState(false)

  // const handleCreateEmailTemplate = async (newName: string) => {
  //   const result = await postNewEmailTemplateForCourseInstance(courseInstanceId, {
  //     name: newName,
  //   })
  //   setShowForm(!showForm)
  //   // eslint-disable-next-line i18next/no-literal-string
  //   window.location.assign(`/cms/email-templates/${result.id}/edit`)
  // }

  // const handleOnDelete = async (templateId: string) => {
  //   await deleteEmailTemplate(templateId)
  //   await getCourseInstanceEmailTemplates.refetch()
  // }

  return (
    <div
      className={css`
        margin-bottom: 1rem;
      `}
      // eslint-disable-next-line i18next/no-literal-string
    >
      I am here!!!!
    </div>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(CoursePartnersBlock)),
)
