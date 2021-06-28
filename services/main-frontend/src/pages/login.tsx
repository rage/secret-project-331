import Layout from "../components/Layout"
import { login } from "../shared-module/services/backend/auth"
import { useContext, useState } from "react"
import { useRouter } from "next/router"
import LoginStateContext from "../shared-module/contexts/LoginStateContext"

export default function Login(): JSX.Element {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const loginStateContext = useContext(LoginStateContext)

  async function submitForm(event) {
    event.preventDefault()
    await login(email, password)
    await loginStateContext.refresh()
    router.push("/")
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
