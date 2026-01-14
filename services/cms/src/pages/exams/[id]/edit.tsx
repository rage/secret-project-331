"use client"

import { useQuery } from "@tanstack/react-query"
import React, { useState } from "react"

import { fetchExamsInstructions, updateExamsInstructions } from "../../../services/backend/exams"

import { ExamInstructionsUpdate } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady.pages"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

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
    queryKey: [`exam-${examsId}-instructions`],
    gcTime: 0,
    queryFn: async () => {
      const res = await fetchExamsInstructions(examsId)
      setNeedToRunMigrationsAndValidations(true)
      return res
    },
  })

  const saveMutation = useToastMutation(
    (instructions: ExamInstructionsUpdate) => updateExamsInstructions(examsId, instructions),
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
