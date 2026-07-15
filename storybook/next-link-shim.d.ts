// Storybook type-checks synced shared-module components that import next/link. Declare it untyped
// so they resolve here; the real types are checked in shared-module/packages/components.
declare module "next/link"
