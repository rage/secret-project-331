/* eslint-disable i18next/no-literal-string */
export default function replaceUuidsWithPlaceholdersInText(obj: string): string {
  return obj.replace(
    /[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}/g,
    "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  )
}
