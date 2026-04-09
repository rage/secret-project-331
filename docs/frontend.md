## Interacting with the backend

Use generated API clients and React Query option builders from `src/generated/**`.

Regenerate backend-calling clients/types with:

```bash
bin/generate-bindings
```

### Queries

Use generated `...Options(...)` with `useQuery` directly.

```ts
import { useQuery } from "@tanstack/react-query"

import { getCourseMaterialOrganizationOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"

const organizationQuery = useQuery(
  getCourseMaterialOrganizationOptions({
    path: {
      organization_id: organizationId,
    },
  }),
)
```

If query params are optional (for example nullable route params), build options with `optionalGeneratedQueryOptions`:

```ts
import { useQuery } from "@tanstack/react-query"

import { getCourseMaterialCourseOptions } from "@/generated/course-material-api/@tanstack/react-query.generated"
import { optionalGeneratedQueryOptions } from "@/utils/optionalGeneratedQueryOptions"

const courseQuery = useQuery(
  optionalGeneratedQueryOptions({
    value: courseId,
    isReady: (courseId): courseId is string => Boolean(courseId),
    build: (courseId) =>
      getCourseMaterialCourseOptions({
        path: {
          course_id: courseId,
        },
      }),
  }),
)
```

### Mutations

Use generated `...Mutation(...)` options with `useToastMutationOptions` when you want standard toast behavior.

```ts
import { setCourseModuleCertificateGenerationMutation } from "@/generated/api/@tanstack/react-query.generated"
import useToastMutationOptions from "@/shared-module/common/hooks/useToastMutationOptions"

const toggleCertificateGenerationEnabledMutation = useToastMutationOptions(
  setCourseModuleCertificateGenerationMutation(),
  { notify: true, method: "POST" },
  {
    onSuccess: () => {
      getCourse.refetch()
    },
  },
)
```

For multi-step custom flows that are not a single generated mutation call, use `useToastMutation` with a custom mutation function.

### Cache invalidation

After successful mutations, invalidate or refetch relevant queries using generated query keys/options.

```ts
import { getOauthAuthorizedClientsOptions } from "@/generated/api/@tanstack/react-query.generated"

const authorizedClientsQueryKey = getOauthAuthorizedClientsOptions().queryKey
queryClient.invalidateQueries({ queryKey: authorizedClientsQueryKey })
```

Use local compatibility types only for internal service-specific protocol messages that are not part of generated backend contracts.

## Creating forms

Forms are created using the useForm-hook from [react-hook-form](https://react-hook-form.com/get-started). Looking at already existing forms in the project is also a good starting point.

`useForm` gives us most importantly `register`, `handleSubmit` and `formState: {errors}`. `register` is used to "register" and track form fields. Each input element of the form is registered with a name and will then appear as a field with that name in the data object for `handleSubmit`. `register` allows options for validating the input, like setting it as "required" and setting an error message in case this validation fails. The form is validated this way so there is no need to validate it inside or before handleSubmit.

## General

Use React components from `shared-module/common/components` for a unified appearance. If you need to modify a component from shared-module (edit in root folder), then run the script `bin/shared-module-sync-watch` during editing to make sure that the changes get represented in the UI immediately.
