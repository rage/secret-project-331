"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import PageContext from "../../contexts/PageContext"
import { denormalizeDocument } from "../../utils/documentSchemaProcessor"

import { CmsPageUpdate, Page } from "@/generated/api"
import {
  getCmsCourseOptions,
  getCmsPageOptions,
} from "@/generated/api/@tanstack/react-query.generated"
import { updateCmsPage } from "@/generated/api/sdk.generated"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady.pages"
import dynamicImport from "@/shared-module/common/utils/dynamicImport"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"
import { isGutenbergBlockArray } from "@/utils/Gutenberg/gutenbergBlocks"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

interface PagesProps {
  query: SimplifiedUrlQuery<"id">
}

const PageEditor = dynamicImport(() => import("../../components/editors/PageEditor"))

const Pages = ({ query }: PagesProps) => {
  const { id } = query
  const [needToRunMigrationsAndValidations, setNeedToRunMigrationsAndValidations] = useState(false)
  const queryClient = useQueryClient()
  const getPage = useQuery({
    ...optionalGeneratedQueryOptions({
      value: id,
      isReady: (pageId): pageId is string => Boolean(pageId),
      build: (pageId) =>
        getCmsPageOptions({
          path: {
            page_id: pageId,
          },
        }),
    }),
    gcTime: 0,
    select: (data) => {
      if (!isGutenbergBlockArray(data.page.content)) {
        throw new Error("Content is not a GutenbergBlock array")
      }
      const page: Page = {
        ...data.page,
        content: denormalizeDocument({
          content: data.page.content,
          exercises: data.exercises,
          exercise_slides: data.exercise_slides,
          exercise_tasks: data.exercise_tasks,
          url_path: data.page.url_path,
          title: data.page.title,
          chapter_id: data.page.chapter_id,
        }).content,
      }
      return page
    },
  })
  useEffect(() => {
    if (getPage.isSuccess) {
      setNeedToRunMigrationsAndValidations(true)
    }
  }, [getPage.isSuccess])
  const courseId = getPage.data?.course_id
  const course = useQuery(
    optionalGeneratedQueryOptions({
      value: courseId,
      isReady: (courseId): courseId is string => Boolean(courseId),
      build: (courseId) =>
        getCmsCourseOptions({
          path: {
            course_id: courseId,
          },
        }),
    }),
  )

  const mutate = useToastMutation(
    (newPage: CmsPageUpdate) =>
      updateCmsPage({
        path: {
          page_id: id,
        },
        body: newPage,
      }),
    {
      notify: true,
      dismissable: true,
      method: "PUT",
      toastOptions: { duration: 5000 },
    },
    {
      onSuccess: (newData) => {
        // Refetch, setQueryData or invalidateQueries?
        // eslint-disable-next-line i18next/no-literal-string
        queryClient.setQueryData([`page-${id}`], newData)
      },
    },
  )
  return (
    <>
      {getPage.isError && <ErrorBanner variant={"readOnly"} error={getPage.error} />}
      {getPage.isLoading && <Spinner variant={"medium"} />}
      {getPage.isSuccess && (
        <PageContext.Provider value={{ page: getPage.data }}>
          <PageEditor
            data={getPage.data}
            courseCanAddChatbot={!!course.data?.can_add_chatbot}
            saveMutation={mutate}
            needToRunMigrationsAndValidations={needToRunMigrationsAndValidations}
            setNeedToRunMigrationsAndValidations={setNeedToRunMigrationsAndValidations}
          />
        </PageContext.Provider>
      )}
    </>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(Pages)))
