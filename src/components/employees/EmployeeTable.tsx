import { useState } from "react";
import { Employee } from "@/lib/mock-data";
import { useDepartments, useEmployees } from "@/hooks/use-local-data";
import { useUser } from "@/contexts/UserContext";
import { useToast } from "@/hooks/use-toast";
import { formatCFA } from "@/lib/payroll-engine";
import { StatusBadge } from "./StatusBadge";
import { MoreHorizontal, Eye, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useNavigate } from "react-router-dom";

interface EmployeeTableProps {
  employees: Employee[];
  onEdit?: (employee: Employee) => void;
  onDelete?: (employee: Employee) => void;
}

export function EmployeeTable({ employees, onEdit, onDelete }: EmployeeTableProps) {
  const navigate = useNavigate();
  const { departments } = useDepartments();
  const { deleteEmployee } = useEmployees();
  const { toast } = useToast();
  const { can } = useUser();
  const [employeeToDelete, setEmployeeToDelete] = useState<Employee | null>(null);
  
  const getDepartmentName = (departmentId: string) => {
    return departments.find(d => d.id === departmentId)?.name || "-";
  };

  const handleEdit = (employee: Employee) => {
    if (onEdit) {
      onEdit(employee);
    } else {
      navigate(`/employees/${employee.id}/edit`);
    }
  };

  const confirmDelete = async () => {
    if (!employeeToDelete) return;
    
    if (onDelete) {
      onDelete(employeeToDelete);
    } else {
      try {
        await deleteEmployee(employeeToDelete.id);
        toast({ 
          title: "Employé supprimé", 
          description: `${employeeToDelete.firstName} ${employeeToDelete.lastName} a été supprimé.` 
        });
      } catch (error) {
        toast({ 
          title: "Erreur", 
          description: "Impossible de supprimer l'employé.", 
          variant: "destructive" 
        });
      }
    }
    setEmployeeToDelete(null);
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <table className="data-table">
        <thead>
          <tr>
            <th>Matricule</th>
            <th>Nom complet</th>
            <th>Département</th>
            <th>Poste</th>
            <th>Statut</th>
            <th className="text-right">Salaire base</th>
            <th className="w-12"></th>
          </tr>
        </thead>
        <tbody>
          {employees.map((employee) => (
            <tr key={employee.id} className="group">
              <td className="font-mono text-xs">{employee.matricule}</td>
              <td>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-semibold text-primary">
                      {employee.firstName[0]}{employee.lastName[0]}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium">{employee.firstName} {employee.lastName}</p>
                    <p className="text-xs text-muted-foreground">{employee.email}</p>
                  </div>
                </div>
              </td>
              <td className="text-muted-foreground">
                {getDepartmentName(employee.departmentId)}
              </td>
              <td>{employee.position}</td>
              <td>
                <StatusBadge status={employee.status} />
              </td>
              <td className="text-right font-medium">
                {formatCFA(employee.baseSalary)}
              </td>
              <td>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => navigate(`/employees/${employee.id}`)}>
                      <Eye className="w-4 h-4 mr-2" />
                      Voir le profil
                    </DropdownMenuItem>
                    {can("employee:edit") && (
                      <DropdownMenuItem onClick={() => handleEdit(employee)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Modifier
                      </DropdownMenuItem>
                    )}
                    {can("employee:delete") && (
                      <DropdownMenuItem 
                        onClick={() => setEmployeeToDelete(employee)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Supprimer
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <AlertDialog open={!!employeeToDelete} onOpenChange={(open) => !open && setEmployeeToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {employeeToDelete?.firstName} {employeeToDelete?.lastName} ? 
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
