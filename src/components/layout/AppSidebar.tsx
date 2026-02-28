import { 
  LayoutDashboard, 
  Users, 
  Building2, 
  Calculator, 
  FileText, 
  BarChart3, 
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  BookOpen,
  Banknote,
  UserCog
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useUser, roleLabels } from "@/contexts/UserContext";
import { UserRole } from "@/lib/mock-data";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  title: string;
  icon: React.ElementType;
  href: string;
  roles?: string[];
}

const navItems: NavItem[] = [
  { title: "Tableau de bord", icon: LayoutDashboard, href: "/" },
  { title: "Employés", icon: Users, href: "/employees" },
  { title: "Départements", icon: Building2, href: "/departments" },
  { title: "Paie", icon: Calculator, href: "/payroll" },
  { title: "Avances", icon: Banknote, href: "/advances" },
  { title: "Bulletins", icon: FileText, href: "/payslips" },
  { title: "Comptabilité", icon: BookOpen, href: "/accounting", roles: ["admin", "accountant"] },
  { title: "Rapports", icon: BarChart3, href: "/reports" },
  { title: "Paramètres", icon: Settings, href: "/settings", roles: ["admin"] },
];

export function AppSidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const location = useLocation();
  const { currentUser, setRole, availableRoles } = useUser();

  const filteredNavItems = navItems.filter(item => {
    if (!item.roles) return true;
    return item.roles.includes(currentUser.role);
  });

  return (
    <aside 
      className={cn(
        "flex flex-col bg-sidebar text-sidebar-foreground transition-all duration-300 border-r border-sidebar-border",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-sidebar-primary flex items-center justify-center">
              <span className="text-sidebar-primary-foreground font-bold text-sm">RH</span>
            </div>
            <span className="font-semibold text-sm">GestionRH</span>
          </div>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-md hover:bg-sidebar-accent transition-colors"
        >
          {collapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <ChevronLeft className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
        {filteredNavItems.map((item) => {
          const isActive = location.pathname === item.href;
          return (
            <NavLink
              key={item.href}
              to={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive 
                  ? "bg-sidebar-primary text-sidebar-primary-foreground" 
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className={cn(
                "w-5 h-5 flex-shrink-0",
                isActive ? "" : "text-sidebar-muted group-hover:text-sidebar-accent-foreground"
              )} />
              {!collapsed && (
                <span className="text-sm font-medium truncate">{item.title}</span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User section with role switcher */}
      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "w-full flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-sidebar-accent transition-colors",
                collapsed ? "justify-center" : ""
              )}
            >
              <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-sidebar-accent-foreground">
                  {currentUser.name.split(' ').map(n => n[0]).join('')}
                </span>
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-medium truncate">{currentUser.name}</p>
                  <p className="text-xs text-sidebar-muted">
                    {roleLabels[currentUser.role]}
                  </p>
                </div>
              )}
              {!collapsed && <UserCog className="w-4 h-4 text-sidebar-muted" />}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Changer de rôle (Test)</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableRoles.map((role) => (
              <DropdownMenuItem
                key={role}
                onClick={() => setRole(role)}
                className={cn(
                  currentUser.role === role && "bg-accent"
                )}
              >
                <span className="flex-1">{roleLabels[role]}</span>
                {currentUser.role === role && (
                  <span className="text-xs text-muted-foreground">actif</span>
                )}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => alert('Déconnexion - Fonctionnalité à venir avec authentification.')}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}
