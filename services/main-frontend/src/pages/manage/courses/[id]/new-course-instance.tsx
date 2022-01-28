import { css } from "@emotion/css"
import { useRouter } from "next/router"
import React from "react"
import { useTranslation } from "react-i18next"
import { useMutation } from "react-query"

import Layout from "../../../../components/Layout"
import NewCourseInstanceForm from "../../../../components/page-specific/manage/courses/id/new-course-instance/NewCourseInstanceForm"
import { newCourseInstance } from "../../../../services/backend/courses"
import { CourseInstanceForm } from "../../../../shared-module/bindings"
import ErrorBanner from "../../../../shared-module/components/ErrorBanner"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
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

  const mutation = useMutation(
    async (form: CourseInstanceForm) => {
      await newCourseInstance(courseId, form)
    },
    {
      onSuccess: () => {
        // eslint-disable-next-line i18next/no-literal-string
        router.push(`/manage/courses/${courseId}`)
      },
    },
  )

  return (
    <Layout navVariant="complex">
      <div
        className={css`
          margin-bottom: 1rem;
        `}
      >
        <h1>{t("new-course-instance")}</h1>
        {mutation.isError && <ErrorBanner variant={"readOnly"} error={mutation.error} />}
        <NewCourseInstanceForm
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
