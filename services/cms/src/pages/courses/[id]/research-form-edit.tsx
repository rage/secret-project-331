import { useQuery } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import React, { useContext, useState } from "react"

import CourseContext from "../../../contexts/CourseContext"
import {
  fetchResearchFormWithCourseId,
  upsertResearchForm,
} from "../../../services/backend/courses"
import { NewResearchForm, ResearchForm } from "../../../shared-module/bindings"
import Button from "../../../shared-module/components/Button"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../shared-module/contexts/LoginStateContext"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import { assertNotNullOrUndefined } from "../../../shared-module/utils/nullability"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

interface ResearchFormProps {
  query: SimplifiedUrlQuery<"id">
}

const EditorLoading = <Spinner variant="medium" />

const ResearchFormEditor = dynamic(
  () => import("../../../components/editors/ResearchConsentFormEditor"),
  {
    ssr: false,
    loading: () => EditorLoading,
  },
)

const ResearchForms = ({ query }: ResearchFormProps) => {
  const { id } = query
  const [needToRunMigrationsAndValidations, setNeedToRunMigrationsAndValidations] = useState(false)
  const courseId = useContext(CourseContext)?.courseId
  const getResearchForm = useQuery(
    [`courses-${id}-research-consent-form`],
    () => fetchResearchFormWithCourseId(id),
    {
      select: (data) => {
        const form: ResearchForm = {
          ...data,
          content: data.content,
        }
        return form
      },
      onSuccess: () => {
        setNeedToRunMigrationsAndValidations(true)
      },
    },
  )
  console.log("aaa")

  const handleSave = async (form: NewResearchForm): Promise<ResearchForm> => {
    const res = await upsertResearchForm(assertNotNullOrUndefined(id), {
      ...form,
    })
    await getResearchForm.refetch()
    return res
  }
  console.log(courseId, id)
  const handleCreateNewForm = async () => {
    const res = await upsertResearchForm(assertNotNullOrUndefined(id), {
      course_id: assertNotNullOrUndefined(id),
      content: [],
    })
    await getResearchForm.refetch()
    console.log(res)
  }

  return (
    <>
      {getResearchForm.isLoading && <Spinner variant={"medium"} />}
      {getResearchForm.isSuccess && (
        <CourseContext.Provider value={{ courseId: assertNotNullOrUndefined(id) }}>
          <ResearchFormEditor
            data={getResearchForm.data}
            handleSave={handleSave}
            needToRunMigrationsAndValidations={needToRunMigrationsAndValidations}
            setNeedToRunMigrationsAndValidations={setNeedToRunMigrationsAndValidations}
          />
        </CourseContext.Provider>
      )}
      {getResearchForm.isError && (
        // eslint-disable-next-line i18next/no-literal-string
        <Button variant="primary" size="medium" onClick={handleCreateNewForm}>
          create
        </Button>
      )}
    </>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(ResearchForms)))
