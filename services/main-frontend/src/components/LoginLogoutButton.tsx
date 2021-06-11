import { loggedIn, logout } from "../services/backend/auth";
import Link from "next/link";
import { useQuery } from "react-query";

export default function LoginLogoutButton () {
  const { isLoading, error, data, refetch } = useQuery(`logged-in`, () => loggedIn());

  if (isLoading) {
    return <>Loading...</>
  }

  if (data) {
    const submitLogout = async (event) => {
      event.preventDefault();
      await logout();
      await refetch();
    };
    return <form onSubmit={submitLogout}>
      <button type="submit">Logout</button>
    </form>
  } else {
    return <Link href="/login">Login</Link>
  }
}
