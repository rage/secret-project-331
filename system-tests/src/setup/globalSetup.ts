import { login } from "../utils/login"

// Create session states for each user, state will be named as username, e.g. admin.json
async function globalSetup() {
  console.log("Creating login states for supported test users.")
  await login("admin", "admin")
  await login("teacher", "teacher")
  await login("user", "user")
}

export default globalSetup
