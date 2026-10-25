import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import NotionLessonStudio from '@/components/NotionLessonStudio';
import { loadTeacherMaterialLibraryContext } from '@/utils/materialLibraryLoader';
import { Lesson } from '@/types/database.types';

interface EditLessonPageProps {
  params: Promise<{ id: string; lessonId: string }>;
}

export default async function EditLessonPage({ params }: EditLessonPageProps) {
  const { id: classId, lessonId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: classData, error: classError } = await supabase
    .from('classes')
    .select('id, name, teacher_id')
    .eq('id', classId)
    .single();

  if (classError || !classData) {
    notFound();
  }

  // 교사 본인만 레슨 및 교안 수정 가능
  if (classData.teacher_id !== user.id) {
    redirect(`/classes/${classId}/lessons/${lessonId}`);
  }

  const { data: lessonData, error: lessonError } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .eq('class_id', classId)
    .single();

  if (lessonError || !lessonData) {
    notFound();
  }

  const { existingSubjects, existingUnits } =
    await loadTeacherMaterialLibraryContext(user.id);

  return (
    <NotionLessonStudio
      classId={classId}
      className={classData.name}
      mode="edit"
      initialLesson={lessonData as Lesson}
      existingSubjects={existingSubjects}
      existingUnits={existingUnits}
    />
  );
}
