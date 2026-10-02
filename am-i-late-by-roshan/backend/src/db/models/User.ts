import { query, queryOne } from '../connection';

export interface User {
  id: string;
  email: string;
  display_name: string | null;
  created_at: Date;
}

export interface UserWithHash extends User {
  password_hash: string;
}

export async function createUser(email: string, passwordHash: string, displayName: string | null): Promise<User> {
  const row = await queryOne<User>(
    `INSERT INTO users (email, password_hash, display_name) VALUES (lower($1), $2, $3)
     RETURNING id, email, display_name, created_at`,
    [email, passwordHash, displayName],
  );
  return row!;
}

export function findUserByEmail(email: string): Promise<UserWithHash | null> {
  return queryOne<UserWithHash>('SELECT * FROM users WHERE email = lower($1)', [email]);
}

export function findUserById(id: string): Promise<User | null> {
  return queryOne<User>('SELECT id, email, display_name, created_at FROM users WHERE id = $1', [id]);
}

export async function deleteUser(id: string): Promise<void> {
  await query('DELETE FROM users WHERE id = $1', [id]);
}
