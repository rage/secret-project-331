// Ambient declarations for the standalone type-check of this package.
// Side-effect CSS imports (e.g. `@fontsource/*` font faces in GlobalStyles) have no
// type declarations of their own; consuming apps supply these via their bundler types.
declare module "*.css"
