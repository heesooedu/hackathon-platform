export type UserRole = 'teacher' | 'student';

export interface Profile {
  id: string;
  role: UserRole | null;
  name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface ClassItem {
  id: string;
  teacher_id: string;
  name: string;
  join_code: string;
  created_at: string;
  teacher?: Profile;
  member_count?: number;
}

export interface ClassMember {
  id: string;
  class_id: string;
  student_id: string;
  joined_at: string;
  student?: Profile;
}

export type LessonStatus = 'open' | 'closed';

export interface Lesson {
  id: string;
  class_id: string;
  title: string;
  learning_objective: string;
  deadline: string | null;
  status: LessonStatus;
  material_html: string | null;
  created_at: string;
}
