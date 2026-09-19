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

export type SubmissionType = 'question' | 'confusion' | 'understood' | 'explore';

export interface Submission {
  id: string;
  lesson_id: string;
  student_id: string;
  type: SubmissionType;
  content: string;
  created_at: string;
  updated_at: string;
  student?: Profile;
}

export interface Answer {
  id: string;
  group_id: string;
  author_id: string;
  content: string;
  is_teacher_checked: boolean;
  created_at: string;
  author?: Profile;
}

export interface QuestionGroup {
  id: string;
  lesson_id: string;
  representative_title: string;
  representative_content: string;
  is_published: boolean;
  is_resolved: boolean;
  created_at: string;
  members?: {
    id: string;
    submission: Submission;
  }[];
  answers?: Answer[];
}
