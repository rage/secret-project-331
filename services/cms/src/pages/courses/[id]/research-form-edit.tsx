import { useQuery } from "@tanstack/react-query"
import { BlockInstance } from "@wordpress/blocks"
import dynamic from "next/dynamic"
import React, { useState } from "react"
import { useTranslation } from "react-i18next"

import { ResearchConsentQuestionAttributes } from "../../../blocks/ResearchConsentQuestion"
import CourseContext from "../../../contexts/CourseContext"
import {
  fetchResearchFormWithCourseId,
  upsertResearchForm,
  upsertResearchFormQuestions,
} from "../../../services/backend/courses"

import {
  NewResearchForm,
  NewResearchFormQuestion,
  ResearchForm,
} from "@/shared-module/common/bindings"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

interface ResearchFormProps {
  query: SimplifiedUrlQuery<"id">
}

interface ResearchContent {
  name: string
  clientId: string
  attributes: { content: string }
}
const EditorLoading = <Spinner variant="medium" />

const ResearchFormEditor = dynamic(
  () => import("../../../components/editors/ResearchConsentFormEditor"),
  {
    ssr: false,
    loading: () => EditorLoading,
  },
)

const ResearchForms: React.FC<React.PropsWithChildren<ResearchFormProps>> = ({ query }) => {
  const [needToRunMigrationsAndValidations, setNeedToRunMigrationsAndValidations] = useState(false)
  const courseId = query.id
  const { t } = useTranslation()

  const getResearchForm = useQuery({
    queryKey: [`courses-${courseId}-research-consent-form`],
    queryFn: () => {
      const res = fetchResearchFormWithCourseId(courseId)
      // This only works when gCTime is set to 0
      setNeedToRunMigrationsAndValidations(true)
      return res
    },
    gcTime: 0,
    select: (data) => {
      if (data === null) {
        return null
      }
      const form: ResearchForm = {
        ...data,
        content: data.content as ResearchContent,
      }
      return form
    },
  })

  const handleCreateNewForm = async () => {
    await upsertResearchForm(assertNotNullOrUndefined(courseId), {
      course_id: assertNotNullOrUndefined(courseId),
      content: [],
    })
    await getResearchForm.refetch()
  }
  const mutate = useToastMutation(
    async (form: NewResearchForm) => {
      if (!isBlockInstanceArray(form.content)) {
        throw new Error("content is not block instance")
      }
      const researchForm = await upsertResearchForm(assertNotNullOrUndefined(courseId), form)
      const questions: NewResearchFormQuestion[] = []
      form.content.forEach((block) => {
        if (isMoocfiCheckbox(block)) {
          const newResearchQuestion: NewResearchFormQuestion = {
            question_id: block.clientId,
            course_id: researchForm.course_id,
            research_consent_form_id: researchForm.id,
            question: block.attributes.content,
          }
          questions.push(newResearchQuestion)
        }
        upsertResearchFormQuestions(researchForm.id, questions)
      })
    },
    {
      notify: true,
      dismissable: true,
      method: "PUT",
      toastOptions: { duration: 5000 },
    },
  )
  const handleSave = async (form: NewResearchForm): Promise<ResearchForm> => {
    await mutate.mutateAsync(form)
    const newData = await getResearchForm.refetch()
    return newData.data as ResearchForm
  }

  return (
    <>
      {getResearchForm.isSuccess && (
        <>
          {getResearchForm.data !== null && (
            <CourseContext.Provider value={{ courseId: assertNotNullOrUndefined(courseId) }}>
              <ResearchFormEditor
                data={getResearchForm.data}
                handleSave={handleSave}
                needToRunMigrationsAndValidations={needToRunMigrationsAndValidations}
                setNeedToRunMigrationsAndValidations={setNeedToRunMigrationsAndValidations}
              />
            </CourseContext.Provider>
          )}
          {getResearchForm.data === null && (
            <Button variant="primary" size="medium" onClick={handleCreateNewForm}>
              {t("button-text-create")}
            </Button>
          )}
        </>
      )}
      {getResearchForm.isError && <ErrorBanner error={getResearchForm.error} variant="readOnly" />}
    </>
  )
}

function isBlockInstanceArray(obj: unknown): obj is BlockInstance[] {
  if (!Array.isArray(obj)) {
    return false
  }
  for (const o of obj) {
    if (typeof o.name !== "string" || typeof o.clientId !== "string") {
      return false
    }
  }
  return true
}

function isMoocfiCheckbox(
  obj: BlockInstance,
): obj is BlockInstance<ResearchConsentQuestionAttributes> {
  return obj.name === "moocfi/research-consent-question"
}

const exported = withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(ResearchForms)))

// @ts-expect-error: hideBreadcrumbs is an addtional property on exported
exported.hideBreadcrumbs = true

export default exported
