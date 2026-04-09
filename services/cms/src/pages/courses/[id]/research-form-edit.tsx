"use client"

import { useQuery } from "@tanstack/react-query"
import { BlockInstance } from "@wordpress/blocks"
import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"

import { ResearchConsentQuestionAttributes } from "../../../blocks/ResearchConsentQuestion"
import CourseContext from "../../../contexts/CourseContext"

import { NewResearchForm, NewResearchFormQuestion, ResearchForm } from "@/generated/api"
import { getCmsCourseResearchFormOptions } from "@/generated/api/@tanstack/react-query.generated"
import {
  upsertCmsCourseResearchForm,
  upsertCmsCourseResearchFormQuestions,
} from "@/generated/api/sdk.generated"
import Button from "@/shared-module/common/components/Button"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady.pages"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

interface ResearchFormProps {
  query: SimplifiedUrlQuery<"id">
}

interface ResearchContent {
  name: string
  clientId: string
  attributes: { content: string }
}

const ResearchFormEditor = dynamicImport(
  () => import("../../../components/editors/ResearchConsentFormEditor"),
)

const ResearchForms: React.FC<React.PropsWithChildren<ResearchFormProps>> = ({ query }) => {
  const [needToRunMigrationsAndValidations, setNeedToRunMigrationsAndValidations] = useState(false)
  const courseId = query.id
  const { t } = useTranslation()

  const getResearchForm = useQuery({
    ...optionalGeneratedQueryOptions({
      value: courseId,
      isReady: (courseId): courseId is string => Boolean(courseId),
      build: (courseId) =>
        getCmsCourseResearchFormOptions({
          path: {
            course_id: courseId,
          },
        }),
    }),
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

  useEffect(() => {
    if (getResearchForm.isSuccess) {
      setNeedToRunMigrationsAndValidations(true)
    }
  }, [getResearchForm.isSuccess])

  const handleCreateNewForm = async () => {
    await upsertCmsCourseResearchForm({
      path: {
        course_id: assertNotNullOrUndefined(courseId),
      },
      body: {
        course_id: assertNotNullOrUndefined(courseId),
        content: [],
      },
    })
    await getResearchForm.refetch()
  }
  const mutate = useToastMutation(
    async (form: NewResearchForm) => {
      if (!isBlockInstanceArray(form.content)) {
        throw new Error("content is not block instance")
      }
      const researchForm = await upsertCmsCourseResearchForm({
        path: {
          course_id: assertNotNullOrUndefined(courseId),
        },
        body: form,
      })
      const questions: NewResearchFormQuestion[] = []
      form.content.forEach((block: BlockInstance) => {
        if (isMoocfiCheckbox(block)) {
          const newResearchQuestion: NewResearchFormQuestion = {
            question_id: block.clientId,
            course_id: researchForm.course_id,
            research_consent_form_id: researchForm.id,
            question: block.attributes.content,
          }
          questions.push(newResearchQuestion)
        }
        upsertCmsCourseResearchFormQuestions({
          path: {
            course_id: researchForm.id,
          },
          body: questions,
        })
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
