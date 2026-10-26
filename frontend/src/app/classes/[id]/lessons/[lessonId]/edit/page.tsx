import { notFound, redirect } from 'next/navigation';
import { createClient, getCurrentUser } from '@/utils/supabase/server';
import NotionLessonStudio from '@/components/NotionLessonStudio';
import { loadTeacherMaterialLibraryContext } from '@/utils/materialLibraryLoader';
import { Lesson } from '@/types/database.types';

interface EditLessonPageProps {
  params: Promise<{ id: string; lessonId: string }>;
}

export default async function EditLessonPage({ params }: EditLessonPageProps) {
  const [{ id: classId, lessonId }, user, supabase] = await Promise.all([
    params,
    getCurrentUser(),
    createClient(),
  ]);

  if (!user) {
    redirect('/login');
  }

  const [
    { data: classData, error: classError },
    { data: lessonData, error: lessonError },
    { existingSubjects, existingUnits },
  ] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, teacher_id')
      .eq('id', classId)
      .single(),
    supabase
      .from('lessons')
      .select('*')
      .eq('id', lessonId)
      .eq('class_id', classId)
      .single(),
    loadTeacherMaterialLibraryContext(user.id, {
      includeDeployedMap: false,
      lightweightMasterMaterials: true,
    }),
  ]);

  if (classError || !classData) {
    notFound();
  }

  // 교사 본인만 레슨 및 교안 수정 가능
  if (classData.teacher_id !== user.id) {
    redirect(`/classes/${classId}/lessons/${lessonId}`);
  }

  if (lessonError || !lessonData) {
    notFound();
  }

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
