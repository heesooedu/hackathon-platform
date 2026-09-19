# AGENTS.md

## Project Purpose
Build a question-centered learning platform for teachers and students. Each lesson collects students' questions or understanding status, organizes related questions, supports peer answers, and directly empowers teachers to refine and improve their interactive lesson materials for subsequent classes.

The first release is an MVP for validating the classroom learning loop. Prefer a small, reliable product over broad features.

## Repository & Project Structure
- All frontend Next.js code lives under the `frontend/` directory. Commands (`npm run dev`, `npm install`, etc.) must run in `frontend/`.
- Root contains configuration, `.gitignore`, `.venv/` (for optional Python backend/scripts), and documentation.

## Assumed Stack
- **Framework**: Next.js with App Router (`frontend/src/app`)
- **Language**: TypeScript with strict mode
- **Deployment**: Vercel
- **Backend & Auth**: Supabase (Postgres, Auth, and Row Level Security)
- **Styling**: Tailwind CSS
- Before changing code, inspect the repository and follow its actual stack and conventions. Do not replace working libraries merely to match these assumptions.

## Authentication & Identity Strategy
- Primary auth mechanism: Supabase Auth.
- Designed to support email/password initially, with clear extension paths for **Google OAuth** (e.g., school Google accounts).
- User roles (`teacher` vs `student`) are managed in a dedicated `profiles` table synced via Supabase Auth triggers or server actions.

## Individualized Student Data & Longitudinal Retention
- **Individual Attribution**: Every question or understanding status submitted by a student must permanently retain the author's individual identifier (`student_id`).
- **Immutability**: When questions are clustered or grouped under a representative question, the original student submission record is **never overwritten, combined, or deleted**. Grouping is purely associative (relational mapping).
- **Longitudinal Value**: Student submission data is designed to be queryable over time for individual learning trajectory analysis, teacher guidance, and longitudinal growth tracking.

## MVP Scope
Implement only the following core workflow unless the user explicitly expands the scope:
1. **Teacher Class Management**: A teacher creates and manages a class. Each class generates a simple 6-character alphanumeric join code (e.g., `AB3K9X`).
2. **Student Class Enrollment**: A student joins a class by entering the 6-character class code.
3. **Lesson Creation**: A teacher creates a lesson with a title, learning objective, and question deadline.
4. **Student Submission**: A student submits one item for the lesson (a question, confusion point, exploration topic, or understanding confirmation).
5. **Question Board**: Questions appear on a lesson question board.
6. **Question Grouping**: The teacher can group similar questions manually and edit/designate a representative question.
7. **Peer Answers**: Students can write answers to published questions.
8. **Teacher Verification**: The teacher can mark an answer as checked and a question as resolved.
9. **Teacher Dashboard**: Shows submission status, representative questions, and unresolved questions.

## Explicit Non-Goals for the First MVP
Do not add these features without a direct request:
- AI clustering or automatic AI answers (keep database hooks for future AI analysis, but no speculative logic)
- Points, levels, badges, leaderboards, or grading
- Infinite-scroll social feeds
- School-wide administration features
- Parent accounts
- Payment or subscription systems
- File uploads
- Real-time chat or push notifications
- Complex analytics engines
- Native mobile applications

## Product Vision & Roadmap: Interactive Lesson Materials & In-App Editor
- **Interactive Materials**: Lessons will support interactive, web-based instructional materials constructed with HTML, CSS, and JavaScript (e.g., simulations, interactive widgets, vibe-coded applets).
- **In-App Editing & Vibe-Coding Uploads**: Teachers will be able to upload self-contained interactive web materials or edit lesson materials directly in an in-platform code/content editor.
- **Closing the Feedback Loop**: Student questions collected in a lesson highlight misconceptions, directly informing the teacher which parts of the interactive material need revision or explanation before the next class.
- **MVP Architectural Hook**: While full editor and sandbox rendering are targeted for subsequent phases, database schemas (e.g., `lessons`) should maintain an optional payload slot (such as `material_html` or metadata) to allow frictionless extension.

## Product Principles
- Optimize for the teacher's next instructional decision, not for engagement metrics.
- Do not force students to invent low-quality questions. Allow an understanding-status submission as an alternative.
- Preserve every student's original wording and attribution when questions are grouped.
- Treat student answers as unverified until a teacher checks them.
- Do not rank students by popularity or raw answer count.
- Prefer a lesson-specific question board over a general social feed.
- The product must remain completely functional without any external AI API.
- Keep the interface responsive and usable on both classroom laptops and student smartphones.

## Roles and Permissions
- `teacher`: creates classes and lessons, manages membership, groups questions, moderates answers, views class analytics and student identities.
- `student`: joins classes via code, submits learning-status items, views published questions, writes peer answers.
- Authorization must be enforced in Postgres via **Supabase Row Level Security (RLS)**, not only hidden in the UI:
  - A student may access only classes they have joined.
  - A teacher may manage only classes they own.
  - A student can edit their own submission only while the lesson is open.
  - Only teachers can mark answers as checked or questions as resolved.
  - Never expose `service_role` keys or secrets to browser code.

## Privacy and Classroom Safety
- **Classroom Display**: Student questions shown to peers default to **anonymous** to encourage psychological safety and honest questions.
- **Teacher Visibility**: Teachers can always view student identities associated with submissions for classroom safeguarding and personalized guidance.
- Avoid exposing student email addresses in peer-facing API responses.
- Seed data, screenshots, tests, and logs must not contain real student information.

## Suggested Domain Model
- `profiles`: `id` (references auth.users), `role` (`'teacher'` | `'student'`), `name`, `avatar_url`, `created_at`
- `classes`: `id`, `teacher_id`, `name`, `join_code` (unique, 6-char), `created_at`
- `class_members`: `class_id`, `student_id`, `joined_at`
- `lessons`: `id`, `class_id`, `title`, `learning_objective`, `deadline`, `status` (`'open'` | `'closed'`), `material_html` (optional, for interactive materials), `created_at`
- `submissions`: `id`, `lesson_id`, `student_id`, `type` (`'question'` | `'confusion'` | `'understood'` | `'explore'`), `content`, `created_at` (immutable)
- `question_groups`: `id`, `lesson_id`, `representative_title`, `representative_content`, `is_published`, `is_resolved`, `created_at`
- `question_group_members`: `group_id`, `submission_id`
- `answers`: `id`, `group_id`, `author_id`, `content`, `is_teacher_checked`, `created_at`

## UI Expectations
- **Language**: Use **Korean UI copy by default** (한국어 기본).
- **Core Screens**:
  - Sign in / Sign up (role selection on onboarding)
  - Teacher: Class list, Class creation, Lesson creation, Lesson dashboard & Question grouping view
  - Student: My classes, Join class modal (code input), Lesson list, Submission form, Question board & Answer view
- Every state requires clear loading, empty, success, and validation error states.
- Responsive design tailored for mobile phones (students) and desktop/tablets (teachers).

## Delivery Sequence (Vertical Slices)
1. **Authentication and roles**: Signup/login flow, profile creation with teacher/student role assignment.
2. **Class creation and membership**: Teacher creates class with join code; student enters code to join class.
3. **Lesson creation**: Teacher creates lesson with objective and deadline.
4. **Student submission**: Student submits question/status; individualized persistence.
5. **Question board**: Board rendering questions (anonymous to peers).
6. **Manual question grouping**: Teacher groups related submissions into representative questions.
7. **Peer answers and teacher verification**: Students answer; teacher verifies.
8. **Minimal teacher dashboard**: High-level review for next-lesson preparation.

