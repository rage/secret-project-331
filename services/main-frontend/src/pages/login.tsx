import Layout from "../components/Layout";
import { login } from "../services/backend/auth";
import { useState } from "react";
import { useRouter } from "next/router";


export default function Login() {
  const router = useRouter();
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");

  async function submitForm(event) {
    event.preventDefault();
    await login(user, password);
    router.push("/");
  }

  return <Layout>
    <form onSubmit={submitForm}>
      <h1>Log in</h1>
      <p>User</p>
      <input type="text" value={user} onChange={(ev) => setUser(ev.target.value)}/>
      <p>Password</p>
      <input type="password" value={password} onChange={(ev) => setPassword(ev.target.value)}/>
      <button>Submit</button>
    </form>
  </Layout>
}
