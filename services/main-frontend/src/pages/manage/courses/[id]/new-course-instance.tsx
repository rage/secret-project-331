import { css } from "@emotion/css"
import { useRouter } from "next/router"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { useMutation } from "react-query"

import Layout from "../../../../components/Layout"
import Form from "../../../../components/forms/CourseInstanceForm"
import { newCourseInstance } from "../../../../services/backend/courses"
import { CourseInstanceForm } from "../../../../shared-module/bindings"
import { isErrorResponse } from "../../../../shared-module/bindings.guard"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { frontendWideWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface Props {
  query: SimplifiedUrlQuery<"id">
}

const NewCourseInstance: React.FC<Props> = ({ query }) => {
  const { t } = useTranslation()
  const courseId = query.id

  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation(
    async (form: CourseInstanceForm) => {
      setError(null)
      await newCourseInstance(courseId, form)
    },
    {
      onSuccess: () => {
        // eslint-disable-next-line i18next/no-literal-string
        router.push(`/manage/courses/${courseId}`)
      },
      onError: (err) => {
        if (isErrorResponse(err)) {
          setError(t("message-creating-failed"))
        } else {
          setError(t("message-creating-failed"))
        }
      },
    },
  )

  return (
    <Layout navVariant="complex">
      <div
        className={css`
          ${frontendWideWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        <h1>{t("new-course-instance")}</h1>
        {error && <div>{error}</div>}
        <Form
          initialData={null}
          onSubmit={(data) => mutation.mutate(data)}
          onCancel={() => router.back()}
        />
      </div>
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(NewCourseInstance)),
)
