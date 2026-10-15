# Internationalization

See the [react-i18next docs](https://react.i18next.com/) and [i18next docs](https://www.i18next.com/).

Prefer shorter, reusable strings. For example, use `Remove` instead of `Remove image` so the translation can be reused elsewhere.

## Lint

All translatable strings are enforced by an ESLint plugin. It will report `Disallow literal` errors where strings should use translations.

## Language codes

For UI translations, short language codes are preferred (`en`, `fi`). Long codes are supported and inherit from the base language. For example, `en-GB` would inherit from `en` and only override strings that differ.

For specifying the language of a course, use a long language code.

## VSCode snippets

- `ut` - inserts the `useTranslation` hook
- `tj` - inserts the `t` function in a JSX context

## Workflow

Open a terminal in `shared-module` and run:

```bash
pnpm run watch
```

This keeps translation file changes automatically synchronized across services.

Here's a video showing the workflow, `ut` and `tj` snippets, and when not to use `tj` (non-JSX context):

https://user-images.githubusercontent.com/1922896/139198182-4fd3ce70-60dc-444a-8615-e2a9b58b5a7f.mp4

## Fixing false positive 'disallow literal string' errors

Try these in order (prefer options higher on the list):

1. Move the literal to a top-level constant with an uppercase name, e.g. `const CONSTANT = 'foo'`. Use this for temporary content that will be replaced later instead of suppressing with a comment.
2. Suppress the specific instance with an ESLint comment (VS Code suggests this automatically).
3. Add the property/function name to the ESLint config ignore list. Only do this if you are certain no real translatable strings will be silenced.

## React components inside translatable strings

Use the `Trans` component from react-i18next. Note: it does not re-render on language change unless you pass the `t` function.

See: https://react.i18next.com/latest/trans-component

## Upper-case text

If the design requires upper-case text, store the string in lowercase in the translation file and apply `text-transform: uppercase` in CSS.
