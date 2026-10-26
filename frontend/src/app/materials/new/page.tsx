import { redirect } from 'next/navigation';
import { getCurrentUser, getCurrentProfile } from '@/utils/supabase/server';
import { loadTeacherMaterialLibraryContext } from '@/utils/materialLibraryLoader';
import NotionLessonStudio from '@/components/NotionLessonStudio';

interface NewMaterialPageProps {
  searchParams: Promise<{
    subject?: string;
    unit?: string;
    classId?: string;
  }>;
}

export default async function NewMaterialPage({ searchParams }: NewMaterialPageProps) {
  const [resolvedSearchParams, user, profile] = await Promise.all([
    searchParams,
    getCurrentUser(),
    getCurrentProfile(),
  ]);

  if (!user) {
    redirect('/login');
  }

  if (profile?.role !== 'teacher') {
    redirect('/');
  }

  const { teacherClasses, existingSubjects, existingUnits } =
    await loadTeacherMaterialLibraryContext(user.id, {
      includeDeployedMap: false,
      lightweightMasterMaterials: true,
    });

  return (
    <NotionLessonStudio
      mode="library-create"
      teacherClasses={teacherClasses}
      existingSubjects={existingSubjects}
      existingUnits={existingUnits}
      defaultSubject={resolvedSearchParams.subject || ''}
      defaultUnit={resolvedSearchParams.unit || ''}
      defaultDeployClassId={resolvedSearchParams.classId || ''}
    />
  );
}
