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
export type MaterialType = 'markdown' | 'html';

export interface MaterialGapItem {
  id: string;
  target_section: string;
  critique: string;
  related_questions_summary: string;
  student_count: number;
  suggested_patch_title: string;
  suggested_patch_markdown: string;
}

export interface GeneratedQuizDraft {
  question_text: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
  rationale: string;
  target_concept: string;
}

export interface AiLessonAnalysisResult {
  overall_diagnosis: string;
  next_class_opening_guide: string;
  gap_items: MaterialGapItem[];
  suggested_interactive_improvement?: string;
  formative_quizzes: GeneratedQuizDraft[];
  analyzed_at: string;
}

export interface AppliedPatchItem {
  id: string;
  title: string;
  content_markdown: string;
  applied_at: string;
  source_questions_summary?: string;
}

export interface Lesson {
  id: string;
  class_id: string;
  title: string;
  learning_objective: string;
  deadline: string | null;
  status: LessonStatus;
  material_html: string | null;
  material_type?: MaterialType;
  material_markdown?: string | null;
  material_file_name?: string | null;
  ai_supplement_markdown?: string | null;
  ai_review_json?: AiLessonAnalysisResult | null;
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

export interface QuizAttempt {
  id: string;
  quiz_id: string;
  lesson_id: string;
  student_id: string;
  selected_option_index: number;
  is_correct: boolean;
  created_at: string;
  student?: Profile;
}

export interface FormativeQuiz {
  id: string;
  lesson_id: string;
  question_text: string;
  options: string[];
  correct_option_index: number;
  explanation: string;
  rationale: string;
  target_concept?: string | null;
  is_published: boolean;
  created_at: string;
  attempts?: QuizAttempt[];
}
