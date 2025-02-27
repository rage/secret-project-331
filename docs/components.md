# Components

## Dialogs

### Most dialogs

- Use `StandardDialog` from shared-module/common/components/dialogs/StandardDialog.tsx

### Alert, confirm, prompt

```tsx
// In components:
const { alert, confirm, prompt } = useDialog()
await alert("Title", "Message")
const confirmed = await confirm("Are you sure?") // returns boolean
const name = await prompt("Enter name", "Message", "default") // returns string | null
```
