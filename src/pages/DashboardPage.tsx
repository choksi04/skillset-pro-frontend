import { useAuth } from '@/contexts/AuthContext';
import { AdminDashboard } from '@/components/dashboard/admin/AdminDashboard';
import { ManagerDashboard } from '@/components/dashboard/manager/ManagerDashboard';
import { EmployeeDashboard } from '@/components/dashboard/employee/EmployeeDashboard';
import { DashboardNotice } from '@/components/dashboard/shared/DashboardNotice';

export default function DashboardPage() {
  const { currentRole } = useAuth();

  return (
    <div data-tour="dashboard">
      <DashboardNotice />
      {currentRole === 'admin' ? (
        <AdminDashboard />
      ) : currentRole === 'manager' ? (
        <ManagerDashboard />
      ) : (
        <EmployeeDashboard />
      )}
    </div>
  );
}
