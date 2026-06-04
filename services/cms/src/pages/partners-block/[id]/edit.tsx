"use client"

import { useQuery } from "@tanstack/react-query"
import React from "react"

import CourseContext from "../../../contexts/CourseContext"

import { PartnersBlock } from "@/generated/api"
import { getCmsCoursePartnersBlockOptions } from "@/generated/api/@tanstack/react-query.generated"
import { upsertCmsCoursePartnersBlock } from "@/generated/api/sdk.generated"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady.pages"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { QueryResult } from "@/shared-module/components/components/queryResult/QueryResult"
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

  return (
    <QueryResult query={blockQuery}>
      {(data) => {
        const handleSave = async (saveData: unknown): Promise<PartnersBlock> => {
          const res = await upsertCmsCoursePartnersBlock({
            path: {
              course_id: courseId,
            },
            body: saveData ?? [],
          })
          await blockQuery.refetch()
          return res as PartnersBlock
        }

        return (
          <CourseContext.Provider value={{ courseId: courseId }}>
            <PartnersBlockEditor data={data} handleSave={handleSave} />
          </CourseContext.Provider>
        )
      }}
    </QueryResult>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(PartnersBlockEdit)),
)
