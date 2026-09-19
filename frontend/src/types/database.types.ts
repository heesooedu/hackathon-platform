export type UserRole = 'teacher' | 'student';

export interface Profile {
  id: string;
  role: UserRole;
  name: string;
  avatar_url: string | null;
  created_at: string;
}

