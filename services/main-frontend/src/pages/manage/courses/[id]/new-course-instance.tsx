import { css } from "@emotion/css"
import { useRouter } from "next/router"
import React, { useState } from "react"
import { useMutation } from "react-query"

import Layout from "../../../../components/Layout"
import Form from "../../../../components/forms/CourseInstanceForm"
import { newCourseInstance } from "../../../../services/backend/courses"
import { CourseInstanceForm } from "../../../../shared-module/bindings"
import { isErrorResponse } from "../../../../shared-module/bindings.guard"
import { withSignedIn } from "../../../../shared-module/contexts/LoginStateContext"
import { wideWidthCenteredComponentStyles } from "../../../../shared-module/styles/componentStyles"
import {
  dontRenderUntilQueryParametersReady,
  SimplifiedUrlQuery,
} from "../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../shared-module/utils/withErrorBoundary"

interface Props {
  query: SimplifiedUrlQuery<"id">
}

const NewCourseInstance: React.FC<Props> = ({ query }) => {
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
        router.push(`/manage/courses/${courseId}`)
      },
      onError: (err) => {
        if (isErrorResponse(err)) {
          setError(`Failed to create course instance: ${err.message}`)
        } else {
          setError(`Unexpected error while creating course instance: ${JSON.stringify(err)}`)
        }
      },
    },
  )

  return (
    <Layout navVariant="complex">
      <div
        className={css`
          ${wideWidthCenteredComponentStyles}
          margin-bottom: 1rem;
        `}
      >
        <h1>New course instance</h1>
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
