import { useRouter } from "next/router"
import { useContext, useState } from "react"

import Layout from "../components/Layout"
import LoginStateContext from "../shared-module/contexts/LoginStateContext"
import useQueryParameter from "../shared-module/hooks/useQueryParameter"
import { login } from "../shared-module/services/backend/auth"
import withErrorBoundary from "../shared-module/utils/withErrorBoundary"

const Login: React.FC = () => {
  const loginStateContext = useContext(LoginStateContext)

  const router = useRouter()
  const [notification, setNotification] = useState<string | null>(null)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const uncheckedReturnTo = useQueryParameter("return_to")

  async function submitForm(event) {
    event.preventDefault()
    try {
      await login(email, password).then((result) => {
        console.log(result)
      })
    } catch (e) {
      console.log("failed to login: ", e)
      if (e.response.status === 401) {
        setNotification("Incorrect email or password")
      } else {
        setNotification("Failed to authenticate")
      }
      setTimeout(() => {
        setNotification(null)
      }, 3000)
      return null
    }

    await loginStateContext.refresh()
    const returnTo = validateRouteOrDefault(uncheckedReturnTo, "/")
    router.push(returnTo)
  }

  return (
    <Layout frontPageUrl={baseUrl()} navVariant="simple">
      <form onSubmit={submitForm}>
        <h1>Log in</h1>
        <p>Email</p>
        <input
          type="text"
          name="email"
          value={email}
          onChange={(ev) => setEmail(ev.target.value)}
        />
        <p>Password</p>
        <input
          type="password"
          name="password"
          value={password}
          onChange={(ev) => setPassword(ev.target.value)}
        />
        <button name="login">Submit</button>
      </form>
      {notification && <p>{notification}</p>}
    </Layout>
  )
}

export default withErrorBoundary(Login)

function validateRouteOrDefault(returnPath: string | undefined, defaultPath: string): string {
  if (!returnPath) {
    return defaultPath
  }

  // Only match paths like /asd, /asd/dfg, ...
  const match = returnPath.match(/^(\/\S+)+/)
  if (match === null) {
    return defaultPath
  }

  // Don't allow "returning" to login page
  if (returnPath === "/login") {
    return defaultPath
  }

  return returnPath
}
function baseUrl(): string {
  throw new Error("Function not implemented.")
}
