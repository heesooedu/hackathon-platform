import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
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
  const resolvedSearchParams = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (profile?.role !== 'teacher') {
    redirect('/');
  }

  const { teacherClasses, existingSubjects, existingUnits } =
    await loadTeacherMaterialLibraryContext(user.id);

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
