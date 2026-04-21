"use client"

import { useQuery } from "@tanstack/react-query"
import React from "react"

import CourseContext from "../../../contexts/CourseContext"

import { PartnersBlock } from "@/generated/api"
import { getCmsCoursePartnersBlockOptions } from "@/generated/api/@tanstack/react-query.generated"
import { upsertCmsCoursePartnersBlock } from "@/generated/api/sdk.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady.pages"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const PartnersBlockEditor = dynamicImport(
  () => import("../../../components/editors/PartnersBlockEditor"),
)

export interface PartnersBlockProps {
  query: SimplifiedUrlQuery<"id">
}

const PartnersBlockEdit: React.FC<React.PropsWithChildren<PartnersBlockProps>> = ({ query }) => {
  // const [needToRunMigrationsAndValidations, setNeedToRunMigrationsAndValidations] = useState(false)
  const courseId = query.id
  const blockQuery = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      isReady: (courseId): courseId is string => Boolean(courseId),
      build: (courseId) =>
        getCmsCoursePartnersBlockOptions({
          path: {
            course_id: courseId,
          },
        }),
    }),
  )

  if (blockQuery.isError) {
    return (
      <>
        <ErrorBanner variant="readOnly" error={blockQuery.error} />
      </>
    )
  }

  if (blockQuery.isLoading || !blockQuery.data) {
    return <Spinner variant="medium" />
  }

  const handleSave = async (data: unknown): Promise<PartnersBlock> => {
    const res = await upsertCmsCoursePartnersBlock({
      path: {
        course_id: courseId,
      },
      body: data ?? [],
    })
    await blockQuery.refetch()
    return res as PartnersBlock
  }

  return (
    <CourseContext.Provider value={{ courseId: courseId }}>
      <PartnersBlockEditor data={blockQuery.data} handleSave={handleSave} />
    </CourseContext.Provider>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(PartnersBlockEdit)),
)
