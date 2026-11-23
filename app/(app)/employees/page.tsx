import { listStaff } from "@/actions/staff";
import { requireOwner } from "@/lib/context";
import { EmployeesManager } from "@/components/employees/EmployeesManager";
import { RolesReference } from "@/components/employees/RolesReference";

export default async function EmployeesPage() {
  await requireOwner();
  const staff = await listStaff();

  return (
    <div className="flex w-full flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">Employees & Roles</h1>
        <p className="mt-1 text-sm text-gray-500">
          Add workers, give them a role, and choose exactly which menus they can see and edit.
          You (Owner) always have full access.
        </p>
      </div>
      <EmployeesManager staff={staff} />
      <RolesReference />
    </div>
  );
}
