import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"

import Layout from "../../../../../../components/Layout"
import { getCourseInstanceUserExerciseStatesForUser } from "../../../../../../services/backend/course-instances"
import ErrorBanner from "../../../../../../shared-module/components/ErrorBanner"
import Spinner from "../../../../../../shared-module/components/Spinner"
import { withSignedIn } from "../../../../../../shared-module/contexts/LoginStateContext"
import dontRenderUntilQueryParametersReady from "../../../../../../shared-module/utils/dontRenderUntilQueryParametersReady"
import withErrorBoundary from "../../../../../../shared-module/utils/withErrorBoundary"

interface ManageCourseInstancesProps {
  query: { id: string; userId: string }
}

const ManageCourseInstances: React.FC<ManageCourseInstancesProps> = ({ query }) => {
  const { t } = useTranslation()
  const courseInstanceId = query.id
  const userId = query.userId

  const dataQuery = useQuery(
    ["get-course-instance-user-execise-states-for-user", courseInstanceId, userId],
    () => getCourseInstanceUserExerciseStatesForUser(courseInstanceId, userId),
  )

  return (
    <Layout navVariant="simple">
      <h1>{t("label-course-instance")}</h1>

      {dataQuery.isError && <ErrorBanner variant={"readOnly"} error={dataQuery.error} />}
      {dataQuery.isLoading && <Spinner variant={"medium"} />}
      {dataQuery.isSuccess && (
        <>
          <pre>{JSON.stringify(dataQuery.data, undefined, 2)}</pre>
        </>
      )}
    </Layout>
  )
}

export default withErrorBoundary(
  withSignedIn(dontRenderUntilQueryParametersReady(ManageCourseInstances)),
)
