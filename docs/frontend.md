## Interacting with the backend

You can use an axios instance to avoid repeating the root of the API URL for every request. For example, `main-frontend` has the following client:

```ts
export const mainFrontendClient = axios.create({ baseURL: "/api/v0/main-frontend" })
```

`shared-module` contains types (in `bindings.ts`) and guards (in `bindings.guard`) generated from the backend types as well as other helper functions (in `utils`) which should be used when interacting with the backend. For example, `main-frontend` fetches `/api/v0/main-frontend/organizations` with

```ts
import { Organization } from "@/shared-module/common/bindings"
import { isOrganization } from "@/shared-module/common/bindings.guard"
import { isArray, validateResponse } from "@/shared-module/common/utils/fetching"

export const fetchOrganizations = async (): Promise<Array<Organization>> => {
  // first, we get a response from the API using mainFrontendClient
  const response = await mainFrontendClient.get("/organizations", { responseType: "json" })
  // then we call validateResponse with the response and a guard that checks that the data's type is Array<Organization>
  return validateResponse(response, isArray(isOrganization))
}
```

## Creating forms

Forms are created using the useForm-hook from [react-hook-form](https://react-hook-form.com/get-started). Looking at already existing forms in the project is also a good starting point.

`useForm` gives us most importantly `register`, `handleSubmit` and `formState: {errors}`. `register` is used to "register" and track form fields. Each input element of the form is registered with a name and will then appear as a field with that name in the data object for `handleSubmit`. `register` allows options for validating the input, like setting it as "required" and setting an error message in case this validation fails. The form is validated this way so there is no need to validate it inside or before handleSubmit.

## General

Use React components from `shared-module/common/components` for a unified appearance. If you need to modify a component from shared-module (edit in root folder), then run the script `bin/shared-module-sync-watch` during editing to make sure that the changes get represented in the UI immediately.
