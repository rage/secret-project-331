import MyCourses from "../components/page-specific/index/MyCourses"
import { withSignedIn } from "../shared-module/contexts/LoginStateContext"
import withErrorBoundary from "../shared-module/utils/withErrorBoundary"

const FrontPage = () => {
  return (
    <div>
      <h1>Welcome to lol</h1>
      <h2>My courses</h2>
      <MyCourses />
      <h2>Register completion and certificates</h2>
      <h2>Permissions</h2>
    </div>
  )
}

export default withErrorBoundary(withSignedIn(FrontPage))
