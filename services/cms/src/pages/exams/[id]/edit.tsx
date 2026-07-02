"use client"

import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"

import CmsPageTitle from "../../../components/CmsPageTitle"

import { ExamInstructionsUpdate } from "@/generated/api"
import { getCmsExamInstructionsOptions } from "@/generated/api/@tanstack/react-query.generated"
import { updateCmsExamInstructions } from "@/generated/api/sdk.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady.pages"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components/components/queryResult/QueryResult"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"
import { useTranslation } from "@/utils/useCmsTranslation"

const ExamsInstructionsGutenbergEditor = dynamicImport(
  () => import("../../../components/editors/ExamsInstructionsEditor"),
)

export interface ExamInstructionsEditProps {
  query: SimplifiedUrlQuery<"id">
}

const ExamsInstructionsEditor: React.FC<React.PropsWithChildren<ExamInstructionsEditProps>> = ({
  query,
}) => {
  const { t } = useTranslation()
  const [needToRunMigrationsAndValidations, setNeedToRunMigrationsAndValidations] = useState(false)
  const examsId = query.id
  const getExamsInstructions = useQuery({
    ...optionalGeneratedQueryOptions({
      value: examsId,
      isReady: (examId): examId is string => Boolean(examId),
      build: (examId) =>
        getCmsExamInstructionsOptions({
          path: {
            exam_id: examId,
          },
        }),
    }),
    gcTime: 0,
  })

  const saveMutation = useToastMutation(
    (instructions: ExamInstructionsUpdate) =>
      updateCmsExamInstructions({
        path: {
          exam_id: examsId,
        },
        body: instructions,
      }),
    {
      notify: true,
      method: "PUT",
    },
    {
      onSuccess: () => {
        getExamsInstructions.refetch()
      },
    },
  )

  return (
    <>
      <CmsPageTitle title={t("edit-exam-instructions")} />
      <QueryResult query={getExamsInstructions}>
        {(data) => (
          <ExamsInstructionsGutenbergEditor
            data={data}
            saveMutation={saveMutation}
            needToRunMigrationsAndValidations={needToRunMigrationsAndValidations}
            setNeedToRunMigrationsAndValidations={setNeedToRunMigrationsAndValidations}
          />
        )}
      </QueryResult>
    </>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(ExamsInstructionsEditor)),
)
