import { useQuery, useQueryClient } from "@tanstack/react-query"
import dynamic from "next/dynamic"
import { useState } from "react"

import PageContext from "../../contexts/PageContext"
import { fetchPageWithId, updateExistingPage } from "../../services/backend/pages"
import { denormalizeDocument } from "../../utils/documentSchemaProcessor"

import { CmsPageUpdate, Page } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useToastMutation from "@/shared-module/common/hooks/useToastMutation"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

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
  const getPage = useQuery({
    queryKey: [`page-${id}`],
    gcTime: 0,
    queryFn: async () => {
      const res = await fetchPageWithId(id)
      // This only works when gCTime is set to 0
      setNeedToRunMigrationsAndValidations(true)
      return res
    },
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
    },
  )
  return (
    <>
      {getPage.isError && <ErrorBanner variant={"readOnly"} error={getPage.error} />}
      {getPage.isPending && <Spinner variant={"medium"} />}
      {getPage.isSuccess && (
        <PageContext.Provider value={{ page: getPage.data }}>
          <PageEditor
            data={getPage.data}
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
