import { UserRole } from "./mock-data";

// Define all permissions in the system
export type Permission =
  // Employee management
  | "employee:create"
  | "employee:edit"
  | "employee:delete"
  | "employee:view"
  | "employee:export"
  | "employee:import"
  // Payroll
  | "payroll:view"
  | "payroll:validate"
  | "payroll:approve" // Admin only - final approval after HR validation
  | "payroll:modify"
  | "payroll:export"
  // Payslips
  | "payslip:view"
  | "payslip:download"
  | "payslip:print"
  | "payslip:email"
  | "payslip:modify"
  // Advances
  | "advance:view"
  | "advance:create"
  | "advance:approve"
  | "advance:cancel"
  // Reports
  | "report:view"
  | "report:export"
  // Accounting
  | "accounting:view"
  | "accounting:generate"
  | "accounting:validate"
  | "accounting:export"
  // Departments
  | "department:view"
  | "department:create"
  | "department:edit"
  | "department:delete"
  // Settings
  | "settings:view"
  | "settings:edit";

// Role-based permission matrix
const rolePermissions: Record<UserRole, Permission[]> = {
  admin: [
    // Admin has all permissions
    "employee:create", "employee:edit", "employee:delete", "employee:view", "employee:export", "employee:import",
    "payroll:view", "payroll:validate", "payroll:approve", "payroll:modify", "payroll:export",
    "payslip:view", "payslip:download", "payslip:print", "payslip:email", "payslip:modify",
    "advance:view", "advance:create", "advance:approve", "advance:cancel",
    "report:view", "report:export",
    "accounting:view", "accounting:generate", "accounting:validate", "accounting:export",
    "department:view", "department:create", "department:edit", "department:delete",
    "settings:view", "settings:edit",
  ],
  hr_manager: [
    // HR Manager: employees and payroll
    "employee:create", "employee:edit", "employee:delete", "employee:view", "employee:export", "employee:import",
    "payroll:view", "payroll:validate", "payroll:modify", "payroll:export",
    "payslip:view", "payslip:download", "payslip:print", "payslip:email", "payslip:modify",
    "advance:view", "advance:create", "advance:approve", "advance:cancel",
    "report:view", "report:export",
    "department:view", "department:create", "department:edit", "department:delete",
    "settings:view",
  ],
  accountant: [
    // Accountant: read-only on employees, payroll, reports + full accounting
    "employee:view",
    "payroll:view", "payroll:export",
    "payslip:view", "payslip:download",
    "advance:view",
    "report:view", "report:export",
    "accounting:view", "accounting:generate", "accounting:validate", "accounting:export",
    "department:view",
    "settings:view",
  ],
  employee: [
    // Employee: self-service only
    "payslip:view", "payslip:download",
    "advance:view", "advance:create",
  ],
};

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole, permissions: Permission[]): boolean {
  return permissions.some(p => hasPermission(role, p));
}

export function hasAllPermissions(role: UserRole, permissions: Permission[]): boolean {
  return permissions.every(p => hasPermission(role, p));
}

export function getPermissions(role: UserRole): Permission[] {
  return rolePermissions[role] || [];
}
