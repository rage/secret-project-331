import { useQuery } from "@tanstack/react-query"

import { getMyCourses } from "../../../services/backend/users"
import ErrorBanner from "../../../shared-module/components/ErrorBanner"
import Spinner from "../../../shared-module/components/Spinner"

const MyCourses: React.FC = () => {
  const myCoursesQuery = useQuery({
    queryKey: ["my-courses"],
    queryFn: () => getMyCourses(),
  })
  if (myCoursesQuery.isError) {
    return <ErrorBanner error={myCoursesQuery.error} variant="readOnly" />
  }
  if (myCoursesQuery.isLoading) {
    return <Spinner variant="medium" />
  }
  return <pre>{JSON.stringify(myCoursesQuery.data, undefined, 2)}</pre>
}

export default MyCourses
