import { EmployeeStatus } from "@/lib/mock-data";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: EmployeeStatus;
}

const statusConfig: Record<EmployeeStatus, { label: string; className: string }> = {
  active: { label: "Actif", className: "status-active" },
  suspended: { label: "Suspendu", className: "status-suspended" },
  left: { label: "Parti", className: "status-left" },
  on_leave: { label: "En congé", className: "status-on-leave" },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <span className={cn(config.className)}>
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {config.label}
    </span>
  );
}
