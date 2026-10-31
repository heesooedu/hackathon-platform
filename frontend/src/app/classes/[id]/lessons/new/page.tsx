import { notFound, redirect } from 'next/navigation';
import { createClient, getCurrentUser } from '@/utils/supabase/server';
import NotionLessonStudio from '@/components/NotionLessonStudio';
import { loadTeacherMaterialLibraryContext } from '@/utils/materialLibraryLoader';
import { verifyClassTeacherAccess } from '@/utils/classTeacherAuth';

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
    access,
    { existingSubjects, existingUnits },
  ] = await Promise.all([
    verifyClassTeacherAccess(supabase, classId, user.id),
    loadTeacherMaterialLibraryContext(user.id, {
      includeDeployedMap: false,
      lightweightMasterMaterials: true,
    }),
  ]);

  const classData = access.classData;

  if (!classData) {
    notFound();
  }

  // 대표 교사 및 팀티칭 공동 교사 모두 새 레슨 및 교안 페이지 작성 가능
  if (!access.isTeacher) {
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
