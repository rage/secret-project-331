import Layout from "../components/Layout"
import { login } from "../services/backend/auth"
import { useState } from "react"
import { useRouter } from "next/router"

export default function Login(): JSX.Element {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  async function submitForm(event) {
    event.preventDefault()
    await login(email, password)
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
