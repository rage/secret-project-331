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
import Button from "../../../../shared-module/components/Button"
import Dialog from "../../../../shared-module/components/Dialog"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

export interface CourseInstanceEmailTemplatesProps {
  query: SimplifiedUrlQuery<"id">
}

const CourseInstanceEmailTemplates: React.FC<
  React.PropsWithChildren<CourseInstanceEmailTemplatesProps>
> = ({ query }) => {
  const { t } = useTranslation()
  const courseInstanceId = query.id
  const getCourseInstanceEmailTemplates = useQuery({
    queryKey: [`course-instance-${courseInstanceId}-emails`],
    queryFn: () => fetchCourseInstanceEmailTemplates(courseInstanceId),
  })
  const [showForm, setShowForm] = useState(false)

  const handleCreateEmailTemplate = async (newName: string) => {
    const result = await postNewEmailTemplateForCourseInstance(courseInstanceId, {
      name: newName,
    })
    setShowForm(!showForm)
    // eslint-disable-next-line i18next/no-literal-string
    window.location.assign(`/cms/email-templates/${result.id}/edit`)
  }

  const handleOnDelete = async (templateId: string) => {
    await deleteEmailTemplate(templateId)
    await getCourseInstanceEmailTemplates.refetch()
  }

  return (
    <div
      className={css`
        margin-bottom: 1rem;
      `}
    >
      {/* TODO: Perhaps insert some data regarding the course instance */}
      <h1>{t("title-email-templates")}</h1>
      <Button size="medium" variant="primary" onClick={() => setShowForm(!showForm)}>
        {t("button-text-create")}
      </Button>

      <Dialog open={showForm}>
        <div
          className={css`
            margin: 1rem;
          `}
        >
          <Button size="medium" variant="primary" onClick={() => setShowForm(!showForm)}>
            {t("button-text-close")}
          </Button>
          <NewEmailTemplateForm onSubmitForm={handleCreateEmailTemplate} />
        </div>
      </Dialog>
      {getCourseInstanceEmailTemplates.isError && (
        <ErrorBanner variant={"readOnly"} error={getCourseInstanceEmailTemplates.error} />
      )}
      {getCourseInstanceEmailTemplates.isPending && <Spinner variant={"medium"} />}
      {getCourseInstanceEmailTemplates.isSuccess && (
        <ul>
          {getCourseInstanceEmailTemplates.data.map((template) => {
            return (
              <li key={template.id}>
                {template.name} <a href={`/cms/email-templates/${template.id}/edit`}>{t("edit")}</a>{" "}
                <Button
                  size="medium"
                  variant="secondary"
                  onClick={async () => await handleOnDelete(template.id)}
                >
                  {t("button-text-delete")}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(CourseInstanceEmailTemplates)),
)
