## Interacting with the backend

You can use an axios instance to avoid repeating the root of the API URL for every request. For example, `main-frontend` has the following client:

```ts
export const mainFrontendClient = axios.create({ baseURL: "/api/v0/main-frontend" })
```

`shared-module` contains types (in `bindings.ts`) and guards (in `bindings.guard`) generated from the backend types as well as other helper functions (in `utils`) which should be used when interacting with the backend. For example, `main-frontend` fetches `/api/v0/main-frontend/organizations` with

```ts
import { Organization } from "../../shared-module/common/bindings"
import { isOrganization } from "../../shared-module/common/bindings.guard"
import { isArray, validateResponse } from "../../shared-module/common/utils/fetching"

export const fetchOrganizations = async (): Promise<Array<Organization>> => {
  // first, we get a response from the API using mainFrontendClient
  const response = await mainFrontendClient.get("/organizations", { responseType: "json" })
  // then we call validateResponse with the response and a guard that checks that the data's type is Array<Organization>
  return validateResponse(response, isArray(isOrganization))
}
```
