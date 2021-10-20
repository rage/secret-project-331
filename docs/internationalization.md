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


### etc

#### Upper case text

If the design of the interface demands upper case text, our convention is to put the text in the translation file in lowercase and apply css text-transform: uppercase to the element.


#### False positive 'disallow literal string' eslint messages

Try to do the one of the following. Things further up on the list are preferrable.

1. move the literal string to a constant to the top level of the file with upper case name e.g. `const CONSTANT = 'foo'`
2. Ignore the instance with an eslint comment that vscode suggests
3. Ignore property/function name in eslint config (only do this if you are sure that it will not ignore any real translatable strings. Good examples of functions that should not be ignored are useQuery/useMutation, because the can contain callbacks that contain translatable strings)


#### React components in middle of translatable strings

See the following link. Note that it does not rerender on language change unless you pass it the t function.

https://react.i18next.com/latest/trans-component
