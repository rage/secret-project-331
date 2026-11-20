"use client"

import { useQuery } from "@tanstack/react-query"
import React, { useEffect, useState } from "react"
import { v4 } from "uuid"

import type { NewResearchForm, ResearchForm } from "@/generated/api"
import { getCmsCourseResearchFormOptions } from "@/generated/api/@tanstack/react-query.generated"
import { upsertCmsCourseResearchForm } from "@/generated/api/sdk.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import type { SimplifiedUrlQuery } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady.pages"
import { dontRenderUntilQueryParametersReady } from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady.pages"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import { assertNotNullOrUndefined } from "@/shared-module/common/utils/nullability"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { Button } from "@/shared-module/components"
import { QueryResult } from "@/shared-module/components/components/queryResult/QueryResult"
import type { BlockInstance } from "@/utils/Gutenberg/types"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"
import { useTranslation } from "@/utils/useCmsTranslation"

import CmsPageTitle from "../../../components/CmsPageTitle"
import CourseContext from "../../../contexts/CourseContext"

interface ResearchFormProps {
  query: SimplifiedUrlQuery<"id">
}

const ResearchFormEditor = dynamicImport(
  () => import("../../../components/editors/ResearchConsentFormEditor"),
)

/** A new form starts as an introduction and one empty question; nothing is saved until Save. */
function starterContent(introduction: string): BlockInstance[] {
  return [
    {
      // oxlint-disable-next-line i18next/no-literal-string
      name: "core/paragraph",
      clientId: v4(),
      isValid: true,
      attributes: { content: introduction },
      innerBlocks: [],
    },
    {
      // oxlint-disable-next-line i18next/no-literal-string
      name: "moocfi/research-consent-question",
      clientId: v4(),
      isValid: true,
      attributes: { content: "" },
      innerBlocks: [],
    },
  ]
}

const ResearchForms: React.FC<React.PropsWithChildren<ResearchFormProps>> = ({ query }) => {
  const [needToRunMigrationsAndValidations, setNeedToRunMigrationsAndValidations] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const courseId = query.id
  const { t } = useTranslation()

  const getResearchForm = useQuery({
    ...optionalGeneratedQueryOptions({
      value: courseId,
      isReady: (id): id is string => Boolean(id),
      build: (id) =>
        getCmsCourseResearchFormOptions({
          path: {
            course_id: id,
          },
        }),
    }),
    gcTime: 0,
  })

  useEffect(() => {
    if (getResearchForm.isSuccess) {
      setNeedToRunMigrationsAndValidations(true)
    }
  }, [getResearchForm.isSuccess])

  const mutate = useToastMutation(
    (form: NewResearchForm) =>
      upsertCmsCourseResearchForm({
        path: {
          course_id: assertNotNullOrUndefined(courseId),
        },
        body: form,
      }),
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
      <CmsPageTitle title={t("edit-research-form")} />
      <QueryResult query={getResearchForm}>
        {(data) =>
          data !== null || isCreating ? (
            <CourseContext.Provider value={{ courseId: assertNotNullOrUndefined(courseId) }}>
              <ResearchFormEditor
                initialContent={
                  data !== null
                    ? (data.content as BlockInstance[])
                    : starterContent(t("research-form-starter-introduction"))
                }
                handleSave={handleSave}
                needToRunMigrationsAndValidations={needToRunMigrationsAndValidations}
                setNeedToRunMigrationsAndValidations={setNeedToRunMigrationsAndValidations}
              />
            </CourseContext.Provider>
          ) : (
            <>
              <p>{t("research-form-create-explanation")}</p>
              <Button variant="primary" size="medium" onClick={() => setIsCreating(true)}>
                {t("button-text-create")}
              </Button>
            </>
          )
        }
      </QueryResult>
    </>
  )
}

const exported = withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(ResearchForms)))

// @ts-expect-error: hideBreadcrumbs is an addtional property on exported
exported.hideBreadcrumbs = true

export default exported
