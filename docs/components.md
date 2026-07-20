# Components

## Dialogs

### Most dialogs

- Use `StandardDialog` from shared-module/common/components/dialogs/StandardDialog.tsx

### Alert, confirm, prompt

`useDialog` methods also accept React elements as the dialog body, so you can render custom UI instead of plain strings.

```tsx
// In components:
const { alert, confirm, prompt } = useDialog()
await alert("Here is the body text", "Optional title")
const confirmed = await confirm("Do you really want to continue?", "Please confirm")
const name = await prompt("What's your name?", "Enter name", "default value")
await alert(<CoursePlanSummary plan={plan} />, "Plan summary")
const approved = await confirm(
  <ApprovalDetails owner={owner} deadline={deadline} />,
  "Approve plan",
)
```
