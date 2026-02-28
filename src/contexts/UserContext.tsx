import { createContext, useContext, useState, ReactNode } from "react";
import { UserRole } from "@/lib/mock-data";
import { Permission, hasPermission, hasAnyPermission, hasAllPermissions } from "@/lib/permissions";

interface User {
  id: string;
  name: string;
  role: UserRole;
  email: string;
}

const mockUsers: Record<UserRole, User> = {
  admin: {
    id: "user-admin",
    name: "Admin Système",
    role: "admin",
    email: "admin@entreprise.tg",
  },
  hr_manager: {
    id: "user-hr",
    name: "Marie Dupont",
    role: "hr_manager",
    email: "rh@entreprise.tg",
  },
  accountant: {
    id: "user-accountant",
    name: "Jean Komla",
    role: "accountant",
    email: "comptable@entreprise.tg",
  },
  employee: {
    id: "user-employee",
    name: "Kofi Mensah",
    role: "employee",
    email: "kofi.mensah@entreprise.tg",
  },
};

interface UserContextType {
  currentUser: User;
  setRole: (role: UserRole) => void;
  availableRoles: UserRole[];
  can: (permission: Permission) => boolean;
  canAny: (permissions: Permission[]) => boolean;
  canAll: (permissions: Permission[]) => boolean;
}

const UserContext = createContext<UserContextType | undefined>(undefined);

const STORAGE_KEY = "current_user_role";

export function UserProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<UserRole>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as UserRole) || "admin";
  });

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    localStorage.setItem(STORAGE_KEY, newRole);
  };

  const currentUser = mockUsers[role];
  const availableRoles: UserRole[] = ["admin", "hr_manager", "accountant", "employee"];

  // Permission helpers
  const can = (permission: Permission) => hasPermission(currentUser.role, permission);
  const canAny = (permissions: Permission[]) => hasAnyPermission(currentUser.role, permissions);
  const canAll = (permissions: Permission[]) => hasAllPermissions(currentUser.role, permissions);

  return (
    <UserContext.Provider value={{ currentUser, setRole, availableRoles, can, canAny, canAll }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error("useUser must be used within a UserProvider");
  }
  return context;
}

// Role labels in French
export const roleLabels: Record<UserRole, string> = {
  admin: "Administrateur",
  hr_manager: "Gestionnaire RH",
  accountant: "Comptable",
  employee: "Employé",
};
