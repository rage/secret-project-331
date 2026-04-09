## Interacting with the backend

You can use an axios instance to avoid repeating the root of the API URL for every request. For example, `main-frontend` has the following client:

```ts
export const mainFrontendClient = axios.create({ baseURL: "/api/v0/main-frontend" })
```

Frontend services should prefer Hey API generated types and schemas for backend contracts, and then use small local compatibility types only for service-internal iframe/protocol messages that are not covered by an OpenAPI spec. For example, `main-frontend` fetches `/api/v0/main-frontend/organizations` with generated Zod validation:

```ts
import { z } from "@/generated/api/zod"
import { type Organization } from "@/generated/api"
import { zOrganization } from "@/generated/api/zod.generated"
import { parseMainFrontendResponse } from "@/services/backend/parseMainFrontendResponse"

export const fetchOrganizations = async (): Promise<Array<Organization>> => {
  const response = await mainFrontendClient.get("/organizations", { responseType: "json" })
  return parseMainFrontendResponse(response, z.array(zOrganization))
}
```

## Creating forms

Forms are created using the useForm-hook from [react-hook-form](https://react-hook-form.com/get-started). Looking at already existing forms in the project is also a good starting point.

`useForm` gives us most importantly `register`, `handleSubmit` and `formState: {errors}`. `register` is used to "register" and track form fields. Each input element of the form is registered with a name and will then appear as a field with that name in the data object for `handleSubmit`. `register` allows options for validating the input, like setting it as "required" and setting an error message in case this validation fails. The form is validated this way so there is no need to validate it inside or before handleSubmit.

## General

Use React components from `shared-module/common/components` for a unified appearance. If you need to modify a component from shared-module (edit in root folder), then run the script `bin/shared-module-sync-watch` during editing to make sure that the changes get represented in the UI immediately.
