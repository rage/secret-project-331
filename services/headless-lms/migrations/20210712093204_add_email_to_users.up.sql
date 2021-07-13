-- Add up migration script here
ALTER TABLE users
ADD email VARCHAR(255) NOT NULL CHECK (email LIKE '%@%');
CREATE UNIQUE INDEX users_email ON users (LOWER(email));
