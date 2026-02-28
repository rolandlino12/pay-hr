import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/dashboard/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEmployees, useDepartments, usePayrollRecords, usePayrollSummary } from "@/hooks/use-local-data";
import { formatCFA, calculatePayroll } from "@/lib/payroll-engine";
import { useNavigate } from "react-router-dom";
import { Users, Building2, Wallet, TrendingUp, AlertTriangle, CheckCircle, Loader2, ArrowRight, UserX, Receipt, Briefcase, Shield } from "lucide-react";
import { StatusBadge } from "@/components/employees/StatusBadge";

export default function Dashboard() {
  const navigate = useNavigate();
  const { employees, loading: loadingEmployees } = useEmployees();
  const { departments, loading: loadingDepartments } = useDepartments();
  const { records, loading: loadingRecords } = usePayrollRecords();
  const summary = usePayrollSummary();

  const loading = loadingEmployees || loadingDepartments || loadingRecords;
  
  // Calculate aggregated payroll data
  const activeEmployees = employees.filter(e => e.status === 'active' || e.status === 'on_leave');
  const onLeaveCount = employees.filter(e => e.status === 'on_leave').length;
  
  // Calculate totals from active employees (real-time from employee data, not payroll records)
  let totalIRPP = 0;
  let totalChargesPatronales = 0;
  let totalChargesSociales = 0;
  let totalNetSalary = 0;
  let totalEmployerCost = 0;
  
  activeEmployees.forEach(emp => {
    const breakdown = calculatePayroll({
      baseSalary: emp.baseSalary,
      components: emp.salaryComponents || [], // Utiliser les vrais composants de salaire
      deductions: [], // Les retenues sont gérées séparément
      familyInfo: {
        isMarried: emp.maritalStatus === 'married',
        numberOfChildren: emp.numberOfChildren || 0,
      },
    });
    totalIRPP += breakdown.monthlyIRPP;
    totalChargesPatronales += breakdown.totalEmployerContributions;
    totalChargesSociales += breakdown.cnssEmployee + breakdown.amuEmployee;
    totalNetSalary += breakdown.netSalary;
    totalEmployerCost += breakdown.totalEmployerCost;
  });

  // Recent employees
  const recentEmployees = [...employees]
    .sort((a, b) => new Date(b.hireDate).getTime() - new Date(a.hireDate).getTime())
    .slice(0, 5);

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
        title="Tableau de bord" 
        description="Vue d'ensemble de la gestion RH et paie – Décembre 2024"
      />

      {/* Stats Grid - Row 1 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard
          title="Effectif total"
          value={summary.employeeCount.total}
          subtitle={`${summary.employeeCount.active} actifs`}
          icon={<Users className="w-5 h-5 text-primary" />}
          variant="primary"
        />
        <StatCard
          title="Départements"
          value={summary.departmentCount}
          icon={<Building2 className="w-5 h-5 text-accent" />}
          variant="accent"
        />
        <StatCard
          title="En congé"
          value={onLeaveCount}
          subtitle="Employés absents"
          icon={<UserX className="w-5 h-5 text-warning" />}
          variant="warning"
        />
        <StatCard
          title="Masse salariale"
          value={formatCFA(totalNetSalary)}
          subtitle="Salaires nets"
          icon={<Wallet className="w-5 h-5 text-success" />}
          variant="success"
        />
      </div>

      {/* Stats Grid - Row 2: Financial indicators */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard
          title="IRPP"
          value={formatCFA(totalIRPP)}
          subtitle="Impôt sur le revenu"
          icon={<Receipt className="w-5 h-5 text-destructive" />}
        />
        <StatCard
          title="Charges patronales"
          value={formatCFA(totalChargesPatronales)}
          subtitle="CNSS + AMU employeur"
          icon={<Briefcase className="w-5 h-5 text-primary" />}
        />
        <StatCard
          title="Charges sociales"
          value={formatCFA(totalChargesSociales)}
          subtitle="CNSS + AMU employé"
          icon={<Shield className="w-5 h-5 text-accent" />}
        />
        <StatCard
          title="Coût total employeur"
          value={formatCFA(totalEmployerCost)}
          subtitle="Salaires + charges"
          icon={<TrendingUp className="w-5 h-5 text-warning" />}
          variant="warning"
        />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Employees */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Derniers recrutements</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/employees')}>
              Voir tout
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentEmployees.map((employee) => (
                <div 
                  key={employee.id} 
                  className="flex items-center justify-between cursor-pointer hover:bg-muted/50 -mx-2 px-2 py-1 rounded-lg transition-colors"
                  onClick={() => navigate(`/employees/${employee.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-sm font-semibold text-primary">
                        {employee.firstName[0]}{employee.lastName[0]}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <p className="text-xs text-muted-foreground">{employee.position}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={employee.status} />
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(employee.hireDate).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Payroll Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Alertes & Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {records.filter(p => p.isValidated).length > 0 && (
                <div 
                  className="flex items-start gap-3 p-3 rounded-lg bg-success/5 border border-success/20 cursor-pointer hover:bg-success/10 transition-colors"
                  onClick={() => navigate('/payslips')}
                >
                  <CheckCircle className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">Paie validée</p>
                    <p className="text-xs text-muted-foreground">
                      {records.filter(p => p.isValidated).length} bulletins générés
                    </p>
                  </div>
                </div>
              )}
              {summary.employeeCount.suspended > 0 && (
                <div 
                  className="flex items-start gap-3 p-3 rounded-lg bg-warning/5 border border-warning/20 cursor-pointer hover:bg-warning/10 transition-colors"
                  onClick={() => navigate('/employees')}
                >
                  <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{summary.employeeCount.suspended} employé(s) suspendu(s)</p>
                    <p className="text-xs text-muted-foreground">
                      Vérifier le statut
                    </p>
                  </div>
                </div>
              )}
              {onLeaveCount > 0 && (
                <div 
                  className="flex items-start gap-3 p-3 rounded-lg bg-accent/5 border border-accent/20 cursor-pointer hover:bg-accent/10 transition-colors"
                  onClick={() => navigate('/employees')}
                >
                  <UserX className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium">{onLeaveCount} employé(s) en congé</p>
                    <p className="text-xs text-muted-foreground">
                      Absences en cours
                    </p>
                  </div>
                </div>
              )}
              <div 
                className="flex items-start gap-3 p-3 rounded-lg bg-muted cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => navigate('/reports')}
              >
                <Building2 className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Déclarations à préparer</p>
                  <p className="text-xs text-muted-foreground">
                    CNSS, AMU, IRPP - Échéance: 15 janvier
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}