import { useQuery } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import React, { useState } from "react"

import CourseContext from "../../../contexts/CourseContext"
import { fetchCourseInstance } from "../../../services/backend/course-instances"
import {
  fetchEmailTemplateWithId,
  updateExistingEmailTemplate,
} from "../../../services/backend/email-templates"
import { EmailTemplate, EmailTemplateUpdate } from "../../../shared-module/bindings"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../shared-module/contexts/LoginStateContext"
import useStateQuery from "../../../shared-module/hooks/useStateQuery"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import { assertNotNullOrUndefined } from "../../../shared-module/utils/nullability"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

const EditorLoading = <Spinner variant="medium" />

const EmailEditor = dynamic(() => import("../../../components/editors/EmailEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

export interface EmailTemplateEditProps {
  query: SimplifiedUrlQuery<"id">
}

const EmailTemplateEdit: React.FC<React.PropsWithChildren<EmailTemplateEditProps>> = ({
  query,
}) => {
  const [needToRunMigrationsAndValidations, setNeedToRunMigrationsAndValidations] = useState(false)
  const emailTemplateId = query.id
  // eslint-disable-next-line i18next/no-literal-string
  const templateQuery = useStateQuery(["email-template", emailTemplateId], (_emailTemplateId) =>
    fetchEmailTemplateWithId(_emailTemplateId),
  )
  const courseInstanceId = templateQuery.data?.course_instance_id
  const instanceQuery = useQuery({
    gcTime: 0,
    queryKey: ["course-id-of-instance", courseInstanceId],
    enabled: !!courseInstanceId,
    queryFn: async () => {
      const res = await fetchCourseInstance(assertNotNullOrUndefined(courseInstanceId))
      // This only works when gCTime is set to 0
      setNeedToRunMigrationsAndValidations(true)
      return res
    },
  })

  if (templateQuery.state === "error" || instanceQuery.isError) {
    return (
      <>
        <ErrorBanner variant={"readOnly"} error={templateQuery.error} />
        <ErrorBanner variant={"readOnly"} error={instanceQuery.error} />
      </>
    )
  }

  if (templateQuery.state !== "ready") {
    return <Spinner variant={"medium"} />
  }

  if (instanceQuery.isPending) {
    return <Spinner variant={"medium"} />
  }

  const handleSave = async (template: EmailTemplateUpdate): Promise<EmailTemplate> => {
    const res = await updateExistingEmailTemplate(emailTemplateId, {
      ...template,
    })
    await templateQuery.refetch()
    return res
  }

  return (
    <CourseContext.Provider value={{ courseId: instanceQuery.data.course_id }}>
      <EmailEditor
        data={templateQuery.data}
        handleSave={handleSave}
        needToRunMigrationsAndValidations={needToRunMigrationsAndValidations}
        setNeedToRunMigrationsAndValidations={setNeedToRunMigrationsAndValidations}
      />
    </CourseContext.Provider>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(EmailTemplateEdit)),
)
