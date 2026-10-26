import { redirect } from 'next/navigation';
import { getCurrentUser, getCurrentProfile } from '@/utils/supabase/server';
import { loadTeacherMaterialLibraryContext } from '@/utils/materialLibraryLoader';
import MaterialLibraryDashboard from '@/components/MaterialLibraryDashboard';

export default async function MaterialsPage() {
  const [user, profile] = await Promise.all([
    getCurrentUser(),
    getCurrentProfile(),
  ]);

  if (!user) {
    redirect('/login');
  }

  if (profile?.role !== 'teacher') {
    redirect('/');
  }

  const { masterMaterials, teacherClasses, deployedMap } =
    await loadTeacherMaterialLibraryContext(user.id, {
      includeDeployedMap: true,
      lightweightMasterMaterials: true,
    });

  return (
    <MaterialLibraryDashboard
      initialMaterials={masterMaterials}
      teacherClasses={teacherClasses}
      deployedMap={deployedMap}
    />
  );
}
