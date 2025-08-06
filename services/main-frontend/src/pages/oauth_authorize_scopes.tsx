import { useRouter } from "next/router"
import { useMemo } from "react"

const scopeDescriptions: Record<string, string> = {
  openid: "Authenticate with your account",
  email: "Access your email address",
  profile: "Read your public profile information",
  offline_access: "Allow access when you're offline (refresh tokens)",
}

export default function ConsentPage() {
  const router = useRouter()

  const {
    client_id = "",
    client_name = "Unknown Application",
    redirect_uri = "",
    scope = "",
    state = "",
    nonce = "",
    return_to = "",
  } = router.query

  const scopes = useMemo(() => {
    if (typeof scope === "string") {
      return scope.split(" ").filter(Boolean)
    }
    return []
  }, [scope])

  const handleApprove = () => {
    const approveUrl = `/api/v0/main-frontend/oauth/consent?` +
      `client_id=${encodeURIComponent(String(client_id))}` +
      `&redirect_uri=${encodeURIComponent(String(redirect_uri))}` +
      `&scopes=${encodeURIComponent(scopes.join(" "))}` +
      `&state=${encodeURIComponent(String(state))}` +
      `&nonce=${encodeURIComponent(String(nonce))}` +
      `&return_to=${encodeURIComponent(String(return_to))}`

    window.location.href = approveUrl
  }

  const handleDeny = () => {
    const denyUrl = `/api/v0/main-frontend/oauth/consent/deny?` +
      `client_id=${encodeURIComponent(String(client_id))}` +
      `&redirect_uri=${encodeURIComponent(String(redirect_uri))}` +
      `&state=${encodeURIComponent(String(state))}`

    window.location.href = denyUrl
  }

  return (
    <div className="max-w-md mx-auto mt-10 bg-white shadow-lg rounded-2xl p-6">
      <h2 className="text-2xl font-bold text-center mb-4">
        {client_name} wants access
      </h2>
      <p className="text-gray-700 text-center mb-4">
        This application is requesting the following permissions:
      </p>

      <ul className="list-disc list-inside mb-6">
        {scopes.map((scope) => (
          <li key={scope} className="text-gray-800">
            <strong>{scope}</strong>:{" "}
            {scopeDescriptions[scope] || "No description available"}
          </li>
        ))}
      </ul>

      <div className="flex justify-center gap-4">
        <button
          onClick={handleApprove}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg shadow"
        >
          Approve
        </button>
        <button
          onClick={handleDeny}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg shadow"
        >
          Deny
        </button>
      </div>
    </div>
  )
}
