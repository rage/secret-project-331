// Storybook is not a Next.js app, but it type-checks synced copies of shared-module components
// (under src/shared-module) — some of which import next/link. Declare it as an untyped module so
// those synced components resolve here; their real types are checked in shared-module/packages/components.
declare module "next/link"
