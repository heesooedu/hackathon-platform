import { notFound, redirect } from 'next/navigation';
import { createClient, getCurrentUser } from '@/utils/supabase/server';
import NotionLessonStudio from '@/components/NotionLessonStudio';
import { loadTeacherMaterialLibraryContext } from '@/utils/materialLibraryLoader';

interface NewLessonPageProps {
  params: Promise<{ id: string }>;
}

export default async function NewLessonPage({ params }: NewLessonPageProps) {
  const [{ id: classId }, user, supabase] = await Promise.all([
    params,
    getCurrentUser(),
    createClient(),
  ]);

  if (!user) {
    redirect('/login');
  }

  const [
    { data: classData, error },
    { existingSubjects, existingUnits },
  ] = await Promise.all([
    supabase
      .from('classes')
      .select('id, name, teacher_id')
      .eq('id', classId)
      .single(),
    loadTeacherMaterialLibraryContext(user.id, {
      includeDeployedMap: false,
      lightweightMasterMaterials: true,
    }),
  ]);

  if (error || !classData) {
    notFound();
  }

  // 교사 본인만 새 레슨 및 교안 페이지 작성 가능
  if (classData.teacher_id !== user.id) {
    redirect(`/classes/${classId}`);
  }

  return (
    <NotionLessonStudio
      classId={classId}
      className={classData.name}
      existingSubjects={existingSubjects}
      existingUnits={existingUnits}
    />
  );
}
