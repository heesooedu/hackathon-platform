import { redirect } from 'next/navigation';
import { createClient } from '@/utils/supabase/server';
import { loadTeacherMaterialLibraryContext } from '@/utils/materialLibraryLoader';
import MaterialLibraryDashboard from '@/components/MaterialLibraryDashboard';

export default async function MaterialsPage() {
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

  const { masterMaterials, teacherClasses, deployedMap } =
    await loadTeacherMaterialLibraryContext(user.id);

  return (
    <MaterialLibraryDashboard
      initialMaterials={masterMaterials}
      teacherClasses={teacherClasses}
      deployedMap={deployedMap}
    />
  );
}
