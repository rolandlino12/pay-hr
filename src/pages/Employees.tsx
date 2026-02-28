import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { EmployeeTable } from "@/components/employees/EmployeeTable";
import { useEmployees } from "@/hooks/use-local-data";
import { useUser } from "@/contexts/UserContext";
import { EmployeeStatus } from "@/lib/mock-data";
import { exportAllData } from "@/lib/local-storage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Plus, Search, Download, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Employees() {
  const navigate = useNavigate();
  const { employees, loading } = useEmployees();
  const { toast } = useToast();
  const { can } = useUser();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<EmployeeStatus | "all">("all");

  const handleExport = async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `employees_export_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export réussi", description: "Les données ont été exportées." });
    } catch {
      toast({ title: "Erreur", description: "Échec de l'export.", variant: "destructive" });
    }
  };

  const handleImportClick = () => {
    toast({ title: "Import CSV", description: "Fonctionnalité à venir prochainement." });
  };

  const handleNewEmployee = () => {
    navigate("/employees/new");
  };

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = 
      emp.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.matricule.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.email.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || emp.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  return (
    <MainLayout>
      <PageHeader 
        title="Gestion des employés" 
        description={`${employees.length} employés au total`}
        actions={
          <div className="flex items-center gap-2">
            {can("employee:import") && (
              <Button variant="outline" size="sm" onClick={handleImportClick}>
                <Upload className="w-4 h-4 mr-2" />
                Importer CSV
              </Button>
            )}
            {can("employee:export") && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="w-4 h-4 mr-2" />
                Exporter
              </Button>
            )}
            {can("employee:create") && (
              <Button size="sm" onClick={handleNewEmployee}>
                <Plus className="w-4 h-4 mr-2" />
                Nouvel employé
              </Button>
            )}
          </div>
        }
      />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Rechercher par nom, matricule, email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select 
          value={statusFilter} 
          onValueChange={(value) => setStatusFilter(value as EmployeeStatus | "all")}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Statut" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="active">Actif</SelectItem>
            <SelectItem value="suspended">Suspendu</SelectItem>
            <SelectItem value="left">Parti</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground mb-4">
        {loading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Chargement...
          </span>
        ) : (
          `${filteredEmployees.length} résultat${filteredEmployees.length !== 1 ? 's' : ''}`
        )}
      </p>

      {/* Table */}
      {!loading && <EmployeeTable employees={filteredEmployees} />}
    </MainLayout>
  );
}
