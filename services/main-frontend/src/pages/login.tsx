import Layout from "../components/Layout"
import { login } from "../shared-module/services/backend/auth"
import { useContext, useState } from "react"
import { useRouter } from "next/router"
import LoginStateContext from "../shared-module/contexts/LoginStateContext"
import useQueryParameter from "../shared-module/hooks/useQueryParameter"

export default function Login(): JSX.Element {
  const loginStateContext = useContext(LoginStateContext)

  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const uncheckedReturnTo = useQueryParameter("return_to")

  async function submitForm(event) {
    event.preventDefault()
    await login(email, password)
    await loginStateContext.refresh()
    const returnTo = validateRouteOrDefault(uncheckedReturnTo, "/")
    router.push(returnTo)
  }

  return (
    <Layout>
      <form onSubmit={submitForm}>
        <h1>Log in</h1>
        <p>Email</p>
        <input type="text" value={email} onChange={(ev) => setEmail(ev.target.value)} />
        <p>Password</p>
        <input type="password" value={password} onChange={(ev) => setPassword(ev.target.value)} />
        <button>Submit</button>
      </form>
    </Layout>
  )
}

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
