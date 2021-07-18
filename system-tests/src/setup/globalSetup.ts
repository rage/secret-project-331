import { login } from "../utils/login"

// Create session states for each user, state will be named as username, e.g. admin.json
async function globalSetup() {
  console.log("Creating login states for supported test users.")
  await login("admin@example.com", "admin")
  await login("teacher@example.com", "teacher")
  await login("user@example.com", "user")
}

export default globalSetup
