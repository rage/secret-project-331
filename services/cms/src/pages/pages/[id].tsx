import dynamic from "next/dynamic"
import React from "react"
import { useQuery, useQueryClient } from "react-query"

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
  const queryClient = useQueryClient()
  const getPage = useQuery(`page-${id}`, () => fetchPageWithId(id), {
    select: (data) => {
      const page: Page = { ...data.page, content: denormalizeDocument(data) }
      return page
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
        queryClient.setQueryData(`page-${id}`, newData)
      },
      retry: 3,
    },
  )

  let frontPageUrl = "/"
  if (getPage.isSuccess && getPage.data.course_id) {
    // eslint-disable-next-line i18next/no-literal-string
    frontPageUrl = `/manage/courses/${getPage.data.course_id}/pages`
  }
  return (
    <Layout frontPageUrl={frontPageUrl}>
      {getPage.isError && <ErrorBanner variant={"readOnly"} error={getPage.error} />}
      {(getPage.isLoading || getPage.isIdle) && <Spinner variant={"medium"} />}
      {getPage.isSuccess && <PageEditor data={getPage.data} saveMutation={mutate} />}
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(Pages)))
