import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useDepartments, useEmployees } from "@/hooks/use-local-data";
import { formatCFA } from "@/lib/payroll-engine";
import { Department } from "@/lib/mock-data";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Plus, Users, Wallet, MoreVertical, Edit, Trash2, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function Departments() {
  const { departments, loading: loadingDepartments, addDepartment, updateDepartment, deleteDepartment } = useDepartments();
  const { employees, loading: loadingEmployees } = useEmployees();
  const { toast } = useToast();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [departmentToDelete, setDepartmentToDelete] = useState<Department | null>(null);
  const [formData, setFormData] = useState({ name: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loading = loadingDepartments || loadingEmployees;

  const getDepartmentEmployees = (deptId: string) => 
    employees.filter(e => e.departmentId === deptId && e.status === 'active');

  const calculateDepartmentCost = (deptId: string) => {
    const deptEmployees = employees.filter(e => e.departmentId === deptId && e.status === 'active');
    return deptEmployees.reduce((sum, emp) => {
      const components = emp.salaryComponents.reduce((s, c) => s + c.amount, 0);
      return sum + emp.baseSalary + components;
    }, 0);
  };

  const handleNewDepartment = () => {
    setEditingDepartment(null);
    setFormData({ name: "" });
    setIsDialogOpen(true);
  };

  const handleEditDepartment = (dept: Department) => {
    setEditingDepartment(dept);
    setFormData({ name: dept.name });
    setIsDialogOpen(true);
  };

  const handleDeleteDepartment = (dept: Department) => {
    const deptEmployees = getDepartmentEmployees(dept.id);
    if (deptEmployees.length > 0) {
      toast({
        title: "Impossible de supprimer",
        description: `Ce département contient ${deptEmployees.length} employé(s) actif(s). Réaffectez-les d'abord.`,
        variant: "destructive",
      });
      return;
    }
    setDepartmentToDelete(dept);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!departmentToDelete) return;
    
    try {
      await deleteDepartment(departmentToDelete.id);
      toast({
        title: "Département supprimé",
        description: `${departmentToDelete.name} a été supprimé.`,
      });
    } catch {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue lors de la suppression.",
        variant: "destructive",
      });
    } finally {
      setIsDeleteDialogOpen(false);
      setDepartmentToDelete(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      toast({
        title: "Erreur",
        description: "Le nom du département est requis.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      if (editingDepartment) {
        // Update existing department
        const updated: Department = {
          ...editingDepartment,
          name: formData.name.trim(),
          employeeCount: getDepartmentEmployees(editingDepartment.id).length,
          totalPayrollCost: calculateDepartmentCost(editingDepartment.id),
        };
        await updateDepartment(updated);
        toast({
          title: "Département modifié",
          description: `${formData.name} a été mis à jour.`,
        });
      } else {
        // Create new department
        const newDept: Department = {
          id: `dept-${Date.now()}`,
          name: formData.name.trim(),
          employeeCount: 0,
          totalPayrollCost: 0,
        };
        await addDepartment(newDept);
        toast({
          title: "Département créé",
          description: `${formData.name} a été ajouté.`,
        });
      }
      setIsDialogOpen(false);
      setFormData({ name: "" });
      setEditingDepartment(null);
    } catch {
      toast({
        title: "Erreur",
        description: "Une erreur est survenue.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <PageHeader 
        title="Départements" 
        description="Gérez la structure organisationnelle"
        actions={
          <Button size="sm" onClick={handleNewDepartment}>
            <Plus className="w-4 h-4 mr-2" />
            Nouveau département
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {departments.map((dept) => {
          const deptEmployees = getDepartmentEmployees(dept.id);
          const actualCost = calculateDepartmentCost(dept.id);
          return (
            <Card key={dept.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-start justify-between pb-2">
                <div>
                  <CardTitle className="text-base">{dept.name}</CardTitle>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEditDepartment(dept)}>
                      <Edit className="w-4 h-4 mr-2" />
                      Modifier
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteDepartment(dept)}>
                      <Trash2 className="w-4 h-4 mr-2" />
                      Supprimer
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Users className="w-4 h-4" />
                    <span className="text-sm">{deptEmployees.length} employés</span>
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Wallet className="w-4 h-4" />
                    <span className="text-sm">{formatCFA(actualCost)}</span>
                  </div>
                </div>
                
                {/* Employee avatars */}
                <div className="flex -space-x-2">
                  {deptEmployees.slice(0, 5).map((emp) => (
                    <div 
                      key={emp.id}
                      className="w-8 h-8 rounded-full bg-primary/10 border-2 border-card flex items-center justify-center"
                      title={`${emp.firstName} ${emp.lastName}`}
                    >
                      <span className="text-xs font-medium text-primary">
                        {emp.firstName[0]}{emp.lastName[0]}
                      </span>
                    </div>
                  ))}
                  {deptEmployees.length > 5 && (
                    <div className="w-8 h-8 rounded-full bg-muted border-2 border-card flex items-center justify-center">
                      <span className="text-xs font-medium text-muted-foreground">
                        +{deptEmployees.length - 5}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Add/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingDepartment ? "Modifier le département" : "Nouveau département"}
            </DialogTitle>
            <DialogDescription>
              {editingDepartment 
                ? "Modifiez les informations du département." 
                : "Créez un nouveau département pour organiser vos employés."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="dept-name">Nom du département *</Label>
                <Input
                  id="dept-name"
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  placeholder="Ex: Marketing"
                  autoFocus
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingDepartment ? "Enregistrer" : "Créer"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le département "{departmentToDelete?.name}" ? 
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
