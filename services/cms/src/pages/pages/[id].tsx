import dynamic from "next/dynamic"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import { fetchPageWithId, updateExistingPage } from "../../services/backend/pages"
import { CmsPageUpdate, ContentManagementPage, Page } from "../../shared-module/bindings"
import ErrorBanner from "../../shared-module/components/ErrorBanner"
import Spinner from "../../shared-module/components/Spinner"
import { withSignedIn } from "../../shared-module/contexts/LoginStateContext"
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
  const getPage = useQuery(`page-${id}`, () => fetchPageWithId(id), {
    select: (data) => {
      const page: Page = { ...data.page, content: denormalizeDocument(data) }
      return page
    },
  })

  const handleSave = async (page: CmsPageUpdate): Promise<ContentManagementPage> => {
    const res = await updateExistingPage(id, page)
    console.log(res)
    // NB! Refetched page content isn't used atm, only url, ids etc. Updated content is returned instead.
    await getPage.refetch()
    return res
  }

  let frontPageUrl = "/"
  if (getPage.isSuccess && getPage.data.course_id) {
    // eslint-disable-next-line i18next/no-literal-string
    frontPageUrl = `/manage/courses/${getPage.data.course_id}/pages`
  }
  return (
    <Layout frontPageUrl={frontPageUrl}>
      {getPage.isError && <ErrorBanner variant={"readOnly"} error={getPage.error} />}
      {(getPage.isLoading || getPage.isIdle) && <Spinner variant={"medium"} />}
      {getPage.isSuccess && <PageEditor data={getPage.data} handleSave={handleSave} />}
    </Layout>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(Pages)))
