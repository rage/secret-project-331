"use client"

import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"

import { ExamInstructionsUpdate } from "@/generated/api"
import { getCmsExamInstructionsOptions } from "@/generated/api/@tanstack/react-query.generated"
import { updateCmsExamInstructions } from "@/generated/api/sdk.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady.pages"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const ExamsInstructionsGutenbergEditor = dynamicImport(
  () => import("../../../components/editors/ExamsInstructionsEditor"),
)

export interface ExamInstructionsEditProps {
  query: SimplifiedUrlQuery<"id">
}

const ExamsInstructionsEditor: React.FC<React.PropsWithChildren<ExamInstructionsEditProps>> = ({
  query,
}) => {
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

  if (getExamsInstructions.isError) {
    return <ErrorBanner variant={"readOnly"} error={getExamsInstructions.error} />
  }

  if (getExamsInstructions.isLoading || !getExamsInstructions.data) {
    return <Spinner variant="medium" />
  }

  return (
    <ExamsInstructionsGutenbergEditor
      data={getExamsInstructions.data}
      saveMutation={saveMutation}
      needToRunMigrationsAndValidations={needToRunMigrationsAndValidations}
      setNeedToRunMigrationsAndValidations={setNeedToRunMigrationsAndValidations}
    />
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(ExamsInstructionsEditor)),
)
