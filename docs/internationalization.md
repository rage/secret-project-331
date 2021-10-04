# Internationalization

Easier string to translate `Remove image` -> `Remove`

## Lint

We enforce all translatable strings are translated with an ESLint plugin. It will give you `Disallow literal` string errors on places where you probably should use a translation.

## Short language codes vs long language codes

For translating UI, short language codes preferred. Long language codes supported too, but they inherit the translations from the base language. For example, we have specified that `en` translation is for American English. If we wanted to create a British English translation, we would create them with the `en-GB` identifier. This translation would inherit the `en` translations, and we can just override the strings that differ.

For specifying the language of a course a long language code should be used.
