# Internationalization

Easier string to translate `Remove image` -> `Remove`

## Lint

We enforce all translatable strings are translated with an ESLint plugin. It will give you `Disallow literal` string errors on places where you probably should use a translation.

## Short language codes vs long language codes

For translating UI, short language codes preferred. Long language codes supported too, but they inherit the translations from the base language. For example, we have specified that `en` translation is for American English. If we wanted to create a British English translation, we would create them with the `en-GB` identifier. This translation would inherit the `en` translations, and we can just override the strings that differ.

For specifying the language of a course a long language code should be used.

## VSCode snippets

To get the useTranslation hook, type `ut`.

To use the t function in a JSX context, type `tj`.


## Workflow

Open a terminal in shared-module and run:

```bash
npm run watch
```

to keep changes to the translation files automatically synchronized with the different microservices.

Try to use reusable strings for the interface. For example if you have a button that says "Save page", it might be a good idea to replace that with just "Save" so that we don't need a new translation for that.
