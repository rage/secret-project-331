"use client"

import { css } from "@emotion/css"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useParams } from "next/navigation"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import NewEmailTemplateForm from "./NewEmailTemplateForm"

import {
  deleteEmailTemplateMutation as deleteEmailTemplateMutationOptions,
  getCourseInstanceEmailTemplatesOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { createCourseInstanceEmailTemplate } from "@/generated/api/sdk.generated"
import Button from "@/shared-module/common/components/Button"
import Dialog from "@/shared-module/common/components/dialogs/Dialog"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components"

const CourseInstanceEmailTemplates: React.FC = () => {
  const { t } = useTranslation()
  const { id: courseInstanceId } = useParams<{ id: string }>()
  const getCourseInstanceEmailTemplates = useQuery({
    ...getCourseInstanceEmailTemplatesOptions({
      path: {
        course_instance_id: courseInstanceId,
      },
    }),
  })
  const deleteEmailTemplateMutation = useMutation(deleteEmailTemplateMutationOptions())
  const [showForm, setShowForm] = useState(false)

  const handleCreateEmailTemplate = async (emailTitle: string) => {
    const result = await createCourseInstanceEmailTemplate({
      body: {
        // oxlint-disable-next-line i18next/no-literal-string
        template_type: "generic",
        language: null,
        content: undefined,
        subject: emailTitle || null,
      },
      path: {
        course_instance_id: courseInstanceId,
      },
    })
    setShowForm(!showForm)
    window.location.assign(`/cms/email-templates/${result.id}/edit`)
  }

  const handleOnDelete = async (templateId: string) => {
    await deleteEmailTemplateMutation.mutateAsync({
      path: {
        email_template_id: templateId,
      },
    })
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
      <QueryResult query={getCourseInstanceEmailTemplates} emptyFallback={<ul></ul>}>
        {(data) => (
          <ul>
            {data.map((template) => {
              return (
                <li key={template.id}>
                  {template.subject || template.template_type}{" "}
                  <a href={`/cms/email-templates/${template.id}/edit`}>{t("edit")}</a>{" "}
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
      </QueryResult>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(CourseInstanceEmailTemplates))
