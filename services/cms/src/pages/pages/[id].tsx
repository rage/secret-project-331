import { useQuery, useQueryClient } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import React, { useState } from "react"

import Layout from "../../components/Layout"
import { fetchPageWithId, updateExistingPage } from "../../services/backend/pages"
import { CmsPageUpdate, Page } from "../../shared-module/bindings"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import Spinner from "../../shared-module/components/Spinner"
import { withSignedIn } from "../../shared-module/contexts/LoginStateContext"
import useToastMutation from "../../shared-module/hooks/useToastMutation"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import { denormalizeDocument } from "../../utils/documentSchemaProcessor"

interface PagesProps {
  query: SimplifiedUrlQuery<"id">
}

const EditorLoading = <Spinner variant="medium" />

const PageEditor = dynamic(() => import("../../components/editors/PageEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const Pages = ({ query }: PagesProps) => {
  const { id } = query
  const [needToRunMigrationsAndValidations, setNeedToRunMigrationsAndValidations] = useState(false)
  const queryClient = useQueryClient()
  const getPage = useQuery([`page-${id}`], () => fetchPageWithId(id), {
    select: (data) => {
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
    onSuccess: () => {
      setNeedToRunMigrationsAndValidations(true)
    },
  })

  const mutate = useToastMutation(
    (newPage: CmsPageUpdate) => updateExistingPage(id, newPage),
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
      retry: 3,
    },
  )
  return (
    <Layout>
      {getPage.isError && <ErrorBanner variant={"readOnly"} error={getPage.error} />}
      {(getPage.isLoading || getPage.isIdle) && <Spinner variant={"medium"} />}
      {getPage.isSuccess && (
        <PageEditor
          data={getPage.data}
          saveMutation={mutate}
          needToRunMigrationsAndValidations={needToRunMigrationsAndValidations}
          setNeedToRunMigrationsAndValidations={setNeedToRunMigrationsAndValidations}
        />
      )}
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(Pages)))
