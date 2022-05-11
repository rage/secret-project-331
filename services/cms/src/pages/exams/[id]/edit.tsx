import dynamic from "next/dynamic"
import React, { useState } from "react"
import { useQuery } from "react-query"

import Layout from "../../../components/Layout"
import { fetchExamsInstructions, updateExamsInstructions } from "../../../services/backend/exams"
import { ExamInstructions, ExamInstructionsUpdate } from "../../../shared-module/bindings"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../shared-module/contexts/LoginStateContext"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../shared-module/utils/withErrorBoundary"

const EditorLoading = <Spinner variant="medium" />

const ExamsInstructionsGutenbergEditor = dynamic(
  () => import("../../../components/editors/ExamsInstructionsEditor"),
  {
    ssr: false,
    loading: () => EditorLoading,
  },
)

export interface ExamInstructionsEditProps {
  query: SimplifiedUrlQuery<"id">
}

const ExamsInstructionsEditor: React.FC<ExamInstructionsEditProps> = ({ query }) => {
  const [needToRunMigrationsAndValidations, setNeedToRunMigrationsAndValidations] = useState(false)
  const examsId = query.id
  const getExamsInstructions = useQuery(
    `exam-${examsId}-instructions`,
    () => fetchExamsInstructions(examsId),
    { onSuccess: () => setNeedToRunMigrationsAndValidations(true) },
  )

  const handleSave = async (instructions: ExamInstructionsUpdate): Promise<ExamInstructions> => {
    const res = await updateExamsInstructions(examsId, {
      ...instructions,
    })
    await getExamsInstructions.refetch()
    return res
  }

  if (getExamsInstructions.isIdle || getExamsInstructions.isLoading) {
    return <Spinner variant="medium" />
  }

  if (getExamsInstructions.isError) {
    return <ErrorBanner variant={"readOnly"} error={getExamsInstructions.error} />
  }

  return (
    <Layout>
      <ExamsInstructionsGutenbergEditor
        data={getExamsInstructions.data}
        handleSave={handleSave}
        needToRunMigrationsAndValidations={needToRunMigrationsAndValidations}
        setNeedToRunMigrationsAndValidations={setNeedToRunMigrationsAndValidations}
      />
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(ExamsInstructionsEditor)),
)
