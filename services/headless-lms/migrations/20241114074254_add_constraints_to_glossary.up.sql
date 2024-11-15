ALTER TABLE glossary
ADD CONSTRAINT term_not_empty CHECK (trim(term) <> ''),
  ADD CONSTRAINT definition_not_empty CHECK (trim(definition) <> '');
