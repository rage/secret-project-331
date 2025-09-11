# Components

## Dialogs

### Most dialogs

- Use `StandardDialog` from shared-module/common/components/dialogs/StandardDialog.tsx

### Alert, confirm, prompt

```tsx
// In components:
const { alert, confirm, prompt } = useDialog()
await alert("Here is the body text", "Optional title")
const confirmed = await confirm("Do you really want to continue?", "Please confirm")
const name = await prompt("What's your name?", "Enter name", "default value")
```
