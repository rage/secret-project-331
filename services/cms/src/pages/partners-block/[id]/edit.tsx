import dynamic from "next/dynamic"
import React from "react"

import CourseContext from "../../../contexts/CourseContext"

import { fetchPartnersBlock, setPartnerBlockForCourse } from "@/services/backend/partners-block"
import { PartnersBlock } from "@/shared-module/common/bindings"
import ErrorBanner from "@/shared-module/common/components/ErrorBanner"
import Spinner from "@/shared-module/common/components/Spinner"
import { withSignedIn } from "@/shared-module/common/contexts/LoginStateContext"
import useStateQuery from "@/shared-module/common/hooks/useStateQuery"
import dontRenderUntilQueryParametersReady, {
  SimplifiedUrlQuery,
} from "@/shared-module/common/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "@/shared-module/common/utils/withErrorBoundary"

const EditorLoading = <Spinner variant="medium" />

const PartnersBlockEditor = dynamic(
  () => import("../../../components/editors/PartnersBlockEditor"),
  {
    ssr: false,
    loading: () => EditorLoading,
  },
)

export interface PartnersBlockProps {
  query: SimplifiedUrlQuery<"id">
}

const PartnersBlockEdit: React.FC<React.PropsWithChildren<PartnersBlockProps>> = ({ query }) => {
  // const [needToRunMigrationsAndValidations, setNeedToRunMigrationsAndValidations] = useState(false)
  const courseId = query.id
  // eslint-disable-next-line i18next/no-literal-string
  const blockQuery = useStateQuery(["partners-block", courseId], (courseId) =>
    fetchPartnersBlock(courseId),
  )

  if (blockQuery.state === "error") {
    return (
      <>
        <ErrorBanner variant={"readOnly"} error={blockQuery.error} />
      </>
    )
  }

  if (blockQuery.state !== "ready") {
    return <Spinner variant={"medium"} />
  }

  const handleSave = async (data: unknown): Promise<PartnersBlock> => {
    const res = await setPartnerBlockForCourse(courseId, data ?? [])
    await blockQuery.refetch()
    return res
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
