import { notFound, redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { loadTeacherMaterialLibraryContext } from '@/utils/materialLibraryLoader';
import NotionLessonStudio from '@/components/NotionLessonStudio';

interface EditMaterialPageProps {
  params: Promise<{ materialId: string }>;
}

export default async function EditMaterialPage({ params }: EditMaterialPageProps) {
  const { materialId } = await params;
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

  const {
    libraryClassId,
    masterMaterials,
    teacherClasses,
    deployedMap,
    existingSubjects,
    existingUnits,
  } = await loadTeacherMaterialLibraryContext(user.id);

  if (!libraryClassId) {
    notFound();
  }

  const targetMaterial = masterMaterials.find((m) => m.id === materialId);
  if (!targetMaterial) {
    notFound();
  }

  const alreadyLinkedClassIds = (deployedMap[materialId] || []).map(
    (d) => d.classId
  );

  return (
    <NotionLessonStudio
      mode="library-edit"
      initialLesson={targetMaterial}
      teacherClasses={teacherClasses}
      alreadyLinkedClassIds={alreadyLinkedClassIds}
      existingSubjects={existingSubjects}
      existingUnits={existingUnits}
    />
  );
}
