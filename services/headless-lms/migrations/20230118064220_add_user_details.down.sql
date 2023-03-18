ALTER TABLE users
ADD column first_name VARCHAR(255),
  ADD column last_name VARCHAR(255),
  ADD column email VARCHAR(255);
UPDATE users
SET first_name = user_details.first_name,
  last_name = user_details.last_name,
  email = user_details.email
FROM user_details
WHERE users.id = user_details.user_id;
DROP INDEX users_email;
CREATE UNIQUE INDEX users_email ON users (LOWER(email));
DROP TABLE user_details;
ALTER TABLE users DROP COLUMN email_domain;
