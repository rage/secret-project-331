import dynamic from "next/dynamic"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import PageContext from "../../contexts/PageContext"
import { fetchPageWithId, updateExistingPage } from "../../services/backend/pages"
import { CmsPageUpdate, ContentManagementPage, Page } from "../../shared-module/bindings"
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

interface PageWithOrganizationId {
  page: Page
  organizationId: string
}

const Pages = ({ query }: PagesProps) => {
  const { t } = useTranslation()
  const { id } = query
  const { isLoading, error, data, refetch } = useQuery(`page-${id}`, async () => {
    const data = await fetchPageWithId(id)
    const page: PageWithOrganizationId = {
      page: { ...data.page, content: denormalizeDocument(data) },
      organizationId: data.organization_id,
    }
    return page
  })

  if (error) {
    return (
      <div>
        <h1>{t("error")}</h1>
        <pre>{JSON.stringify(error, undefined, 2)}</pre>
      </div>
    )
  }

  if (isLoading || !data) {
    return <div>{t("loading")}</div>
  }

  const handleSave = async (page: CmsPageUpdate): Promise<ContentManagementPage> => {
    const res = await updateExistingPage(id, page)
    console.log(res)
    // NB! Refetched page content isn't used atm, only url, ids etc. Updated content is returned instead.
    await refetch()
    return res
  }

  return (
    <PageContext.Provider value={{ organizationId: data.organizationId }}>
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <Layout frontPageUrl={`/manage/courses/${data.page.course_id}/pages`}>
        <PageEditor data={data.page} handleSave={handleSave} />
      </Layout>
    </PageContext.Provider>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(Pages)))
