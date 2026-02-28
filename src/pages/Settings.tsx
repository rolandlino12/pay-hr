import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { TAX_CONFIG } from "@/lib/payroll-engine";
import { 
  Building, 
  Shield, 
  Users, 
  Database,
  Upload,
  Save,
  Download,
  Loader2,
  FileUp,
  Image,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { exportAllData, clearStore, bulkAdd, markDatabaseSeeded, importAllData, getById, update, add as addSetting } from "@/lib/local-storage";
import { mockEmployees, mockDepartments, mockPayrollRecords } from "@/lib/mock-data";

interface CompanySettings {
  id: string;
  companyName: string;
  address: string;
  phone: string;
  email: string;
  cnssNumber: string;
  nif: string;
  logo?: string; // Base64 encoded logo
}

const DEFAULT_COMPANY: CompanySettings = {
  id: "company_info",
  companyName: "Entreprise SARL",
  address: "123 Boulevard du 13 Janvier, Lomé",
  phone: "+228 22 21 00 00",
  email: "contact@entreprise.tg",
  cnssNumber: "CNSS-EMP-2010-001",
  nif: "1234567890",
  logo: undefined,
};

export default function Settings() {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [companyData, setCompanyData] = useState<CompanySettings>(DEFAULT_COMPANY);

  // Load company settings on mount
  useEffect(() => {
    async function loadSettings() {
      try {
        const saved = await getById("settings", "company_info");
        if (saved?.value) {
          setCompanyData(saved.value as CompanySettings);
        }
      } catch (error) {
        console.error("Error loading settings:", error);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleCompanyChange = (field: keyof CompanySettings, value: string) => {
    setCompanyData(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveCompany = async () => {
    setIsSaving(true);
    try {
      await update("settings", { id: "company_info", value: companyData });
      toast({ title: "Enregistré", description: "Informations entreprise sauvegardées." });
    } catch (error) {
      toast({ title: "Erreur", description: "Échec de la sauvegarde.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateRates = () => {
    toast({ title: "Information", description: "Les taux sont définis par la législation togolaise et ne peuvent être modifiés." });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une image valide.", variant: "destructive" });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Erreur", description: "L'image ne doit pas dépasser 2 Mo.", variant: "destructive" });
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      setCompanyData(prev => ({ ...prev, logo: base64 }));
      toast({ title: "Logo ajouté", description: "N'oubliez pas d'enregistrer les modifications." });
    };
    reader.readAsDataURL(file);

    if (logoInputRef.current) {
      logoInputRef.current.value = "";
    }
  };

  const handleRemoveLogo = () => {
    setCompanyData(prev => ({ ...prev, logo: undefined }));
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.employees && !data.departments && !data.payrollRecords) {
        throw new Error("Format de fichier invalide");
      }

      // Clear existing data and import new
      if (data.departments) {
        await clearStore("departments");
        await bulkAdd("departments", data.departments);
      }
      if (data.employees) {
        await clearStore("employees");
        await bulkAdd("employees", data.employees);
      }
      if (data.payrollRecords) {
        await clearStore("payrollRecords");
        await bulkAdd("payrollRecords", data.payrollRecords);
      }

      toast({ 
        title: "Import réussi", 
        description: `${data.employees?.length || 0} employés, ${data.departments?.length || 0} départements importés.` 
      });
      
      // Reload to refresh data
      window.location.reload();
    } catch (error) {
      toast({ 
        title: "Erreur d'import", 
        description: "Le fichier n'est pas valide. Utilisez un fichier JSON exporté depuis cette application.", 
        variant: "destructive" 
      });
    }
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleExportAll = async () => {
    try {
      const data = await exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hr_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export réussi", description: "Toutes les données ont été exportées." });
    } catch {
      toast({ title: "Erreur", description: "Échec de l'export.", variant: "destructive" });
    }
  };

  const handleResetData = async () => {
    try {
      // Clear all data stores including advances and payroll logs
      await clearStore("employees");
      await clearStore("departments");
      await clearStore("payrollRecords");
      await clearStore("advances");
      await clearStore("payrollLogs");
      await clearStore("accountingEntries");
      await clearStore("documents");
      await clearStore("settings");
      
      // Re-seed with mock data
      await bulkAdd("departments", mockDepartments);
      await bulkAdd("employees", mockEmployees);
      await bulkAdd("payrollRecords", mockPayrollRecords);
      await markDatabaseSeeded();
      
      toast({ title: "Données réinitialisées", description: "La base de données a été complètement réinitialisée." });
      window.location.reload();
    } catch (error) {
      console.error("Reset error:", error);
      toast({ title: "Erreur", description: "Échec de la réinitialisation.", variant: "destructive" });
    }
  };

  if (isLoading) {
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
        title="Paramètres" 
        description="Configuration du système RH & Paie"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Company Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Building className="w-5 h-5 text-primary" />
              <div>
                <CardTitle className="text-base">Informations entreprise</CardTitle>
                <CardDescription>Données de l'entreprise</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Raison sociale</Label>
              <Input 
                id="company-name" 
                value={companyData.companyName}
                onChange={(e) => handleCompanyChange("companyName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company-address">Adresse</Label>
              <Input 
                id="company-address" 
                value={companyData.address}
                onChange={(e) => handleCompanyChange("address", e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="company-phone">Téléphone</Label>
                <Input 
                  id="company-phone" 
                  value={companyData.phone}
                  onChange={(e) => handleCompanyChange("phone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="company-email">Email</Label>
                <Input 
                  id="company-email" 
                  value={companyData.email}
                  onChange={(e) => handleCompanyChange("email", e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cnss-number">N° CNSS Employeur</Label>
                <Input 
                  id="cnss-number" 
                  value={companyData.cnssNumber}
                  onChange={(e) => handleCompanyChange("cnssNumber", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nif">NIF</Label>
                <Input 
                  id="nif" 
                  value={companyData.nif}
                  onChange={(e) => handleCompanyChange("nif", e.target.value)}
                />
              </div>
            </div>

            <Separator />

            {/* Logo Upload */}
            <div className="space-y-3">
              <Label>Logo de l'entreprise</Label>
              <p className="text-xs text-muted-foreground">
                Ce logo apparaîtra sur les bulletins de paie (en-tête et filigrane)
              </p>
              <input
                type="file"
                ref={logoInputRef}
                onChange={handleLogoUpload}
                accept="image/*"
                className="hidden"
              />
              {companyData.logo ? (
                <div className="flex items-center gap-4">
                  <div className="relative w-24 h-24 border rounded-lg overflow-hidden bg-muted">
                    <img 
                      src={companyData.logo} 
                      alt="Logo entreprise" 
                      className="w-full h-full object-contain"
                    />
                    <button
                      onClick={handleRemoveLogo}
                      className="absolute top-1 right-1 p-1 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    <Image className="w-4 h-4 mr-2" />
                    Changer le logo
                  </Button>
                </div>
              ) : (
                <Button 
                  variant="outline" 
                  onClick={() => logoInputRef.current?.click()}
                >
                  <Image className="w-4 h-4 mr-2" />
                  Ajouter un logo
                </Button>
              )}
            </div>

            <Button className="w-full" onClick={handleSaveCompany} disabled={isSaving}>
              {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
              Enregistrer
            </Button>
          </CardContent>
        </Card>

        {/* Tax Configuration */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Shield className="w-5 h-5 text-warning" />
              <div>
                <CardTitle className="text-base">Configuration fiscale</CardTitle>
                <CardDescription>Taux de cotisations sociales (lecture seule)</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">CNSS</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Part salariale</Label>
                  <Input 
                    value={`${(TAX_CONFIG.cnss.employee * 100).toFixed(1)}%`}
                    disabled
                    className="text-sm bg-muted"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Part patronale</Label>
                  <Input 
                    value={`${(TAX_CONFIG.cnss.employer * 100).toFixed(1)}%`}
                    disabled
                    className="text-sm bg-muted"
                  />
                </div>
              </div>
            </div>
            
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">AMU</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs">Part salariale</Label>
                  <Input 
                    value={`${(TAX_CONFIG.amu.employee * 100).toFixed(1)}%`}
                    disabled
                    className="text-sm bg-muted"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Part patronale</Label>
                  <Input 
                    value={`${(TAX_CONFIG.amu.employer * 100).toFixed(1)}%`}
                    disabled
                    className="text-sm bg-muted"
                  />
                </div>
              </div>
            </div>

            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-xs text-muted-foreground mb-2">IRPP</p>
              <div className="space-y-1">
                <Label className="text-xs">Seuil minimum imposable (mensuel)</Label>
                <Input 
                  value={`${TAX_CONFIG.irpp.minimumTaxableMonthly.toLocaleString()} FCFA`}
                  disabled
                  className="text-sm bg-muted"
                />
              </div>
            </div>

            <p className="text-xs text-muted-foreground text-center">
              Ces taux sont définis par la législation togolaise (LOFI 2023)
            </p>
          </CardContent>
        </Card>

        {/* Roles */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Users className="w-5 h-5 text-accent" />
              <div>
                <CardTitle className="text-base">Rôles & Permissions</CardTitle>
                <CardDescription>Gestion des accès utilisateurs</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { role: 'Admin', desc: 'Accès complet au système', count: 1 },
                { role: 'RH Manager', desc: 'Gestion employés & paie', count: 2 },
                { role: 'Comptable', desc: 'Paie, rapports, conformité', count: 1 },
                { role: 'Employé', desc: 'Consultation bulletins', count: 5 },
              ].map((item) => (
                <div key={item.role} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">{item.role}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <span className="text-xs bg-muted px-2 py-1 rounded">
                    {item.count} utilisateur{item.count > 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Data Management */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Database className="w-5 h-5 text-success" />
              <div>
                <CardTitle className="text-base">Gestion des données</CardTitle>
                <CardDescription>Import/Export et sauvegarde</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileImport}
              accept=".json"
              className="hidden"
            />
            <div className="p-4 border-2 border-dashed rounded-lg text-center">
              <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm font-medium">Importer des données JSON</p>
              <p className="text-xs text-muted-foreground mt-1">
                Restaurer une sauvegarde précédente
              </p>
              <Button variant="outline" size="sm" className="mt-3" onClick={handleImportClick}>
                <FileUp className="w-4 h-4 mr-2" />
                Sélectionner un fichier
              </Button>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <Button variant="outline" className="w-full justify-start" onClick={handleExportAll}>
                <Download className="w-4 h-4 mr-2" />
                Exporter toutes les données
              </Button>
              <Button variant="outline" className="w-full justify-start text-destructive" onClick={handleResetData}>
                <Database className="w-4 h-4 mr-2" />
                Réinitialiser les données (Admin)
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
