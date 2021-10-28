import dynamic from "next/dynamic"
import React from "react"
import { useTranslation } from "react-i18next"
import { useQuery } from "react-query"

import Layout from "../../components/Layout"
import CourseContext from "../../contexts/CourseContext"
import { fetchPageWithId, updateExistingPage } from "../../services/backend/pages"
import { Page, PageUpdate } from "../../shared-module/bindings"
import Spinner from "../../shared-module/components/Spinner"
import { withSignedIn } from "../../shared-module/contexts/LoginStateContext"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../shared-module/utils/withErrorBoundary"
import { denormalizeDocument, normalizeDocument } from "../../utils/documentSchemaProcessor"

interface PagesProps {
  query: SimplifiedUrlQuery<"id">
}

const EditorLoading = <Spinner variant="medium" />

const PageEditor = dynamic(() => import("../../components/editors/PageEditor"), {
  ssr: false,
  loading: () => EditorLoading,
})

const Pages = ({ query }: PagesProps) => {
  const { t } = useTranslation()
  const { id } = query
  const { isLoading, error, data, refetch } = useQuery(`page-${id}`, async () => {
    const data = await fetchPageWithId(id)
    const page: Page = { ...data.page, content: denormalizeDocument(data) }
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

  const handleSave = async (page: PageUpdate): Promise<Page> => {
    const res = await updateExistingPage(
      id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      normalizeDocument(id, page.content as any, page.title, page.url_path, page.chapter_id),
    )
    console.log(res)
    await refetch()
    return res
  }

  return (
    <CourseContext.Provider value={{ courseId: data.course_id }}>
      {/* eslint-disable-next-line i18next/no-literal-string */}
      <Layout frontPageUrl={`/manage/courses/${data.course_id}/pages`}>
        <PageEditor data={data} handleSave={handleSave} />
      </Layout>
    </CourseContext.Provider>
  )
}

export default withErrorBoundary(withSignedIn(dontRenderUntilQueryParametersReady(Pages)))
