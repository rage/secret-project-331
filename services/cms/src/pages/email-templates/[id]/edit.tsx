import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"

import CourseContext from "../../../contexts/CourseContext"
import { fetchCourseInstance } from "../../../services/backend/course-instances"
import {
  fetchEmailTemplateWithId,
  updateExistingEmailTemplate,
} from "../../../services/backend/email-templates"

import { EmailTemplate, EmailTemplateUpdate } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useStateQuery from "@/shared-module/common/hooks/useStateQuery"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const EmailEditor = dynamicImport(() => import("../../../components/editors/EmailEditor"))

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

  if (instanceQuery.isLoading || !instanceQuery.data) {
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
