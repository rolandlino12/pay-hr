import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useDepartments, usePayrollSummary, useEmployees, usePayrollRecords } from "@/hooks/use-local-data";
import { formatCFA, TAX_CONFIG, formatPercent } from "@/lib/payroll-engine";
import { exportToCSV } from "@/lib/file-utils";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Download, 
  FileSpreadsheet,
  Building2,
  Shield,
  Heart,
  Receipt,
  TrendingUp,
  Calendar,
  Loader2,
  Calculator,
  Wallet,
  ArrowUpRight,
  ArrowDownRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Reports() {
  const summary = usePayrollSummary();
  const { departments, loading } = useDepartments();
  const { employees } = useEmployees();
  const { records } = usePayrollRecords();
  const { toast } = useToast();

  const handleExportCNSS = () => {
    const data = employees.filter(e => e.status === 'active').map(emp => {
      const record = records.find(r => r.employeeId === emp.id);
      return {
        Matricule: emp.matricule,
        Nom: emp.lastName,
        Prénom: emp.firstName,
        'N° CNSS': emp.cnssNumber || '',
        'Salaire Brut': record?.grossEarnings || 0,
        'Part Salariale': record?.cnssEmployee || 0,
        'Part Patronale': record?.cnssEmployer || 0,
        'Total': (record?.cnssEmployee || 0) + (record?.cnssEmployer || 0),
      };
    });
    exportToCSV(data, 'declaration_cnss');
    toast({ title: "Export réussi", description: "Déclaration CNSS exportée en CSV." });
  };

  const handleExportAMU = () => {
    const data = employees.filter(e => e.status === 'active').map(emp => {
      const record = records.find(r => r.employeeId === emp.id);
      return {
        Matricule: emp.matricule,
        Nom: emp.lastName,
        Prénom: emp.firstName,
        'Salaire Brut': record?.grossEarnings || 0,
        'Part Salariale': record?.amuEmployee || 0,
        'Part Patronale': record?.amuEmployer || 0,
        'Total': (record?.amuEmployee || 0) + (record?.amuEmployer || 0),
      };
    });
    exportToCSV(data, 'declaration_amu');
    toast({ title: "Export réussi", description: "Déclaration AMU exportée en CSV." });
  };

  const handleExportIRPP = () => {
    const data = employees.filter(e => e.status === 'active').map(emp => {
      const record = records.find(r => r.employeeId === emp.id);
      return {
        Matricule: emp.matricule,
        Nom: emp.lastName,
        Prénom: emp.firstName,
        'Salaire Brut': record?.grossEarnings || 0,
        'Salaire Net Imposable': record?.netSalary || 0,
        'IRPP Retenu': record?.irpp || 0,
      };
    });
    exportToCSV(data, 'declaration_irpp');
    toast({ title: "Export réussi", description: "Déclaration IRPP exportée en CSV." });
  };

  const handleExportPayrollSummary = () => {
    const data = employees.filter(e => e.status === 'active').map(emp => {
      const record = records.find(r => r.employeeId === emp.id);
      const dept = departments.find(d => d.id === emp.departmentId);
      return {
        Matricule: emp.matricule,
        Nom: emp.lastName,
        Prénom: emp.firstName,
        Département: dept?.name || '',
        Poste: emp.position,
        'Salaire Base': emp.baseSalary,
        'Salaire Brut': record?.grossEarnings || 0,
        'CNSS Employé': record?.cnssEmployee || 0,
        'AMU Employé': record?.amuEmployee || 0,
        'IRPP': record?.irpp || 0,
        'Salaire Net': record?.netSalary || 0,
        'Coût Employeur': record?.totalCost || 0,
      };
    });
    exportToCSV(data, 'recapitulatif_paie');
    toast({ title: "Export réussi", description: "Récapitulatif paie exporté en CSV." });
  };

  const handleExportDepartment = () => {
    const data = departments.map(dept => ({
      Département: dept.name,
      'Nombre Employés': dept.employeeCount,
      'Masse Salariale': dept.totalPayrollCost,
    }));
    exportToCSV(data, 'cout_par_departement');
    toast({ title: "Export réussi", description: "Coût par département exporté en CSV." });
  };

  const handleExportAccounting = () => {
    const totalChargesPatronales = summary.currentMonth.totalCNSS * (TAX_CONFIG.cnss.employer / (TAX_CONFIG.cnss.employee + TAX_CONFIG.cnss.employer)) + (summary.currentMonth.totalAMU / 2);
    const totalChargesSalariales = summary.currentMonth.totalCNSS * (TAX_CONFIG.cnss.employee / (TAX_CONFIG.cnss.employee + TAX_CONFIG.cnss.employer)) + (summary.currentMonth.totalAMU / 2) + summary.currentMonth.totalIRPP;
    
    const data = [
      { Compte: '641', Libellé: 'Rémunérations du personnel', Débit: summary.currentMonth.totalGross, Crédit: 0 },
      { Compte: '645', Libellé: 'Charges de sécurité sociale (patronales)', Débit: totalChargesPatronales, Crédit: 0 },
      { Compte: '421', Libellé: 'Personnel - Rémunérations dues', Débit: 0, Crédit: summary.currentMonth.totalNet },
      { Compte: '431', Libellé: 'CNSS', Débit: 0, Crédit: summary.currentMonth.totalCNSS },
      { Compte: '437', Libellé: 'AMU', Débit: 0, Crédit: summary.currentMonth.totalAMU },
      { Compte: '442', Libellé: 'État - IRPP', Débit: 0, Crédit: summary.currentMonth.totalIRPP },
    ];
    exportToCSV(data, 'ecritures_comptables');
    toast({ title: "Export réussi", description: "Écritures comptables exportées en CSV." });
  };

  const handleExportExcel = (reportId: string) => {
    switch (reportId) {
      case 'cnss': handleExportCNSS(); break;
      case 'amu': handleExportAMU(); break;
      case 'irpp': handleExportIRPP(); break;
      case 'payroll-summary': handleExportPayrollSummary(); break;
      case 'department': handleExportDepartment(); break;
      case 'accounting': handleExportAccounting(); break;
    }
  };

  const handleExportAll = () => {
    handleExportCNSS();
    handleExportAMU();
    handleExportIRPP();
    handleExportPayrollSummary();
    handleExportDepartment();
    handleExportAccounting();
    toast({ title: "Export complet", description: "Tous les rapports ont été exportés." });
  };

  const handleMonthSelect = () => {
    toast({ title: "Info", description: "Sélecteur de période - à venir." });
  };

  // Calculate accounting values
  const totalChargesPatronales = summary.currentMonth.totalCNSS * (TAX_CONFIG.cnss.employer / (TAX_CONFIG.cnss.employee + TAX_CONFIG.cnss.employer)) + (summary.currentMonth.totalAMU / 2);
  const totalChargesSalariales = summary.currentMonth.totalCNSS * (TAX_CONFIG.cnss.employee / (TAX_CONFIG.cnss.employee + TAX_CONFIG.cnss.employer)) + (summary.currentMonth.totalAMU / 2) + summary.currentMonth.totalIRPP;

  const accountingEntries = [
    { account: '641', label: 'Rémunérations du personnel', debit: summary.currentMonth.totalGross, credit: 0, type: 'charge' },
    { account: '645', label: 'Charges de sécurité sociale', debit: totalChargesPatronales, credit: 0, type: 'charge' },
    { account: '421', label: 'Personnel - Rémunérations dues', debit: 0, credit: summary.currentMonth.totalNet, type: 'passif' },
    { account: '431', label: 'CNSS', debit: 0, credit: summary.currentMonth.totalCNSS, type: 'passif' },
    { account: '437', label: 'AMU', debit: 0, credit: summary.currentMonth.totalAMU, type: 'passif' },
    { account: '442', label: 'État - IRPP', debit: 0, credit: summary.currentMonth.totalIRPP, type: 'passif' },
  ];

  const totalDebit = accountingEntries.reduce((sum, e) => sum + e.debit, 0);
  const totalCredit = accountingEntries.reduce((sum, e) => sum + e.credit, 0);

  const reports = [
    {
      id: 'cnss',
      title: 'Déclaration CNSS',
      description: 'Caisse Nationale de Sécurité Sociale',
      icon: Shield,
      data: {
        'Part salariale': formatCFA(summary.currentMonth.totalCNSS * (TAX_CONFIG.cnss.employee / (TAX_CONFIG.cnss.employee + TAX_CONFIG.cnss.employer))),
        'Part patronale': formatCFA(summary.currentMonth.totalCNSS * (TAX_CONFIG.cnss.employer / (TAX_CONFIG.cnss.employee + TAX_CONFIG.cnss.employer))),
        'Total': formatCFA(summary.currentMonth.totalCNSS),
      },
      color: 'primary',
    },
    {
      id: 'amu',
      title: 'Déclaration AMU',
      description: 'Assurance Maladie Universelle',
      icon: Heart,
      data: {
        'Part salariale': formatCFA(summary.currentMonth.totalAMU / 2),
        'Part patronale': formatCFA(summary.currentMonth.totalAMU / 2),
        'Total': formatCFA(summary.currentMonth.totalAMU),
      },
      color: 'accent',
    },
    {
      id: 'irpp',
      title: 'Déclaration IRPP',
      description: 'Impôt sur le Revenu des Personnes Physiques',
      icon: Receipt,
      data: {
        'Total retenu': formatCFA(summary.currentMonth.totalIRPP),
        'Nombre de contribuables': `${summary.employeeCount.active} employés`,
      },
      color: 'warning',
    },
    {
      id: 'payroll-summary',
      title: 'Récapitulatif mensuel',
      description: 'Vue d\'ensemble de la masse salariale',
      icon: TrendingUp,
      data: {
        'Salaires bruts': formatCFA(summary.currentMonth.totalGross),
        'Salaires nets': formatCFA(summary.currentMonth.totalNet),
        'Charges totales': formatCFA(summary.currentMonth.totalCNSS + summary.currentMonth.totalAMU),
        'Coût employeur': formatCFA(summary.currentMonth.totalCost),
      },
      color: 'success',
    },
    {
      id: 'department',
      title: 'Coût par département',
      description: 'Répartition de la masse salariale',
      icon: Building2,
      data: Object.fromEntries(
        departments.map(d => [d.name, formatCFA(d.totalPayrollCost)])
      ),
      color: 'default',
    },
  ];

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
        title="Rapports & Déclarations" 
        description="Générez les rapports de conformité et d'analyse"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleMonthSelect}>
              <Calendar className="w-4 h-4 mr-2" />
              Décembre 2024
            </Button>
            <Button size="sm" onClick={handleExportAll}>
              <Download className="w-4 h-4 mr-2" />
              Tout exporter
            </Button>
          </div>
        }
      />

      <Tabs defaultValue="declarations" className="space-y-6">
        <TabsList>
          <TabsTrigger value="declarations">Déclarations</TabsTrigger>
          <TabsTrigger value="comptabilite">Comptabilité</TabsTrigger>
        </TabsList>

        <TabsContent value="declarations" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {reports.map((report) => (
              <Card key={report.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        report.color === 'primary' ? 'bg-primary/10' :
                        report.color === 'accent' ? 'bg-accent/10' :
                        report.color === 'warning' ? 'bg-warning/10' :
                        report.color === 'success' ? 'bg-success/10' :
                        'bg-muted'
                      }`}>
                        <report.icon className={`w-5 h-5 ${
                          report.color === 'primary' ? 'text-primary' :
                          report.color === 'accent' ? 'text-accent' :
                          report.color === 'warning' ? 'text-warning' :
                          report.color === 'success' ? 'text-success' :
                          'text-muted-foreground'
                        }`} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{report.title}</CardTitle>
                        <CardDescription>{report.description}</CardDescription>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleExportExcel(report.id)}>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      CSV
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {Object.entries(report.data).map(([key, value]) => (
                      <div key={key} className="flex justify-between items-center py-1.5 border-b last:border-0">
                        <span className="text-sm text-muted-foreground">{key}</span>
                        <span className="text-sm font-medium">{value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Tax Brackets Reference */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Barème IRPP en vigueur (Togo)</CardTitle>
              <CardDescription>Tranches d'imposition annuelles – LOFI 2023</CardDescription>
            </CardHeader>
            <CardContent>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Tranche</th>
                    <th className="text-right">De</th>
                    <th className="text-right">À</th>
                    <th className="text-right">Taux</th>
                  </tr>
                </thead>
                <tbody>
                  {TAX_CONFIG.irpp.monthlyBrackets.map((bracket, idx, arr) => {
                    const previousMax = idx === 0 ? 0 : arr[idx - 1].max;
                    return (
                      <tr key={idx}>
                        <td className="font-medium">Tranche {idx + 1}</td>
                        <td className="text-right">{formatCFA(previousMax)}</td>
                        <td className="text-right">
                          {bracket.max === Infinity ? '∞' : formatCFA(bracket.max)}
                        </td>
                        <td className="text-right font-semibold">
                          {formatPercent(bracket.rate)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="comptabilite" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-destructive/10">
                    <ArrowUpRight className="w-5 h-5 text-destructive" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Débits</p>
                    <p className="text-xl font-bold">{formatCFA(totalDebit)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-success/10">
                    <ArrowDownRight className="w-5 h-5 text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Crédits</p>
                    <p className="text-xl font-bold">{formatCFA(totalCredit)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Wallet className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Équilibre</p>
                    <p className={`text-xl font-bold ${Math.abs(totalDebit - totalCredit) < 1 ? 'text-success' : 'text-destructive'}`}>
                      {Math.abs(totalDebit - totalCredit) < 1 ? 'Équilibré' : formatCFA(totalDebit - totalCredit)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Accounting Entries Table */}
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Calculator className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Écritures comptables</CardTitle>
                    <CardDescription>Journal de paie du mois</CardDescription>
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={() => handleExportExcel('accounting')}>
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  Exporter CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Compte</th>
                    <th>Libellé</th>
                    <th className="text-right">Débit</th>
                    <th className="text-right">Crédit</th>
                  </tr>
                </thead>
                <tbody>
                  {accountingEntries.map((entry, idx) => (
                    <tr key={idx}>
                      <td className="font-mono font-medium">{entry.account}</td>
                      <td>{entry.label}</td>
                      <td className="text-right">
                        {entry.debit > 0 ? formatCFA(entry.debit) : '-'}
                      </td>
                      <td className="text-right">
                        {entry.credit > 0 ? formatCFA(entry.credit) : '-'}
                      </td>
                    </tr>
                  ))}
                  <tr className="font-bold border-t-2">
                    <td colSpan={2}>Total</td>
                    <td className="text-right">{formatCFA(totalDebit)}</td>
                    <td className="text-right">{formatCFA(totalCredit)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>

          {/* Charges Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Charges patronales</CardTitle>
                <CardDescription>Cotisations à la charge de l'employeur</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">CNSS ({formatPercent(TAX_CONFIG.cnss.employer)})</span>
                    <span className="font-medium">{formatCFA(summary.currentMonth.totalCNSS * (TAX_CONFIG.cnss.employer / (TAX_CONFIG.cnss.employee + TAX_CONFIG.cnss.employer)))}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">AMU ({formatPercent(TAX_CONFIG.amu.employer)})</span>
                    <span className="font-medium">{formatCFA(summary.currentMonth.totalAMU / 2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 font-bold">
                    <span>Total charges patronales</span>
                    <span className="text-primary">{formatCFA(totalChargesPatronales)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Retenues salariales</CardTitle>
                <CardDescription>Prélèvements sur les salaires</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">CNSS ({formatPercent(TAX_CONFIG.cnss.employee)})</span>
                    <span className="font-medium">{formatCFA(summary.currentMonth.totalCNSS * (TAX_CONFIG.cnss.employee / (TAX_CONFIG.cnss.employee + TAX_CONFIG.cnss.employer)))}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">AMU ({formatPercent(TAX_CONFIG.amu.employee)})</span>
                    <span className="font-medium">{formatCFA(summary.currentMonth.totalAMU / 2)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="text-sm text-muted-foreground">IRPP</span>
                    <span className="font-medium">{formatCFA(summary.currentMonth.totalIRPP)}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 font-bold">
                    <span>Total retenues</span>
                    <span className="text-primary">{formatCFA(totalChargesSalariales)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
