import { notFound, redirect } from 'next/navigation';
import { createClient, getCurrentUser } from '@/utils/supabase/server';
import NotionLessonStudio from '@/components/NotionLessonStudio';
import { loadTeacherMaterialLibraryContext } from '@/utils/materialLibraryLoader';
import { verifyClassTeacherAccess } from '@/utils/classTeacherAuth';
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
    access,
    { data: lessonData, error: lessonError },
    { existingSubjects, existingUnits },
  ] = await Promise.all([
    verifyClassTeacherAccess(supabase, classId, user.id),
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

  const classData = access.classData;

  if (!classData) {
    notFound();
  }

  // 대표 교사 및 팀티칭 공동 교사 모두 레슨 및 교안 수정 가능
  if (!access.isTeacher) {
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
