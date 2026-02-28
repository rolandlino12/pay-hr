import { useParams, useNavigate } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { PageHeader } from "@/components/layout/PageHeader";
import { useEmployee, useDepartments, useEmployeePayroll, useEmployeeDocuments } from "@/hooks/use-local-data";
import { calculatePayroll, formatCFA } from "@/lib/payroll-engine";
import { PayrollBreakdownCard } from "@/components/payroll/PayrollBreakdownCard";
import { StatusBadge } from "@/components/employees/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ArrowLeft, 
  Edit, 
  Mail, 
  Phone, 
  Calendar, 
  Building2, 
  CreditCard,
  FileText,
  Download,
  Loader2,
  Upload,
  Trash2,
  Camera
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { readFileAsBase64, downloadDocument, downloadPayslip, EmployeeDocument } from "@/lib/file-utils";
import { getById } from "@/lib/local-storage";

interface CompanySettings {
  name: string;
  companyName?: string;
  address?: string;
  nif?: string;
  cnssNumber?: string;
  logo?: string;
}

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profilePicInputRef = useRef<HTMLInputElement>(null);
  const [company, setCompany] = useState<CompanySettings>({ name: 'Entreprise' });
  
  // Document naming dialog state
  const [showDocDialog, setShowDocDialog] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [docLabel, setDocLabel] = useState("");
  
  const { employee, loading: loadingEmployee, updateEmployee } = useEmployee(id || "");
  const { departments } = useDepartments();
  const { records: payrollHistory, loading: loadingPayroll } = useEmployeePayroll(id || "");
  const { documents, loading: loadingDocs, addDocument, deleteDocument } = useEmployeeDocuments(id || "");

  const loading = loadingEmployee || loadingPayroll;

  // Load company settings
  useEffect(() => {
    const loadCompany = async () => {
      const settings = await getById("settings", "company_info");
      if (settings?.value) {
        const stored = settings.value as CompanySettings;
        setCompany({
          name: stored.companyName || stored.name || 'Entreprise',
          address: stored.address,
          nif: stored.nif,
          cnssNumber: stored.cnssNumber,
          logo: stored.logo
        });
      }
    };
    loadCompany();
  }, []);

  const handleEdit = () => {
    navigate(`/employees/${id}/edit`);
  };

  const handleDownloadDoc = (doc: EmployeeDocument) => {
    downloadDocument(doc);
    toast({ title: "Téléchargement", description: `${doc.label || doc.name} téléchargé.` });
  };

  const handleDeleteDoc = async (doc: EmployeeDocument) => {
    await deleteDocument(doc.id);
    toast({ title: "Document supprimé", description: `${doc.label || doc.name} a été supprimé.` });
  };

  const handleAddDocument = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id) return;

    // Show dialog to name the document
    setPendingFile(file);
    setDocLabel(file.name.replace(/\.[^/.]+$/, "")); // Default to filename without extension
    setShowDocDialog(true);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleConfirmAddDocument = async () => {
    if (!pendingFile || !id || !docLabel.trim()) return;

    try {
      const base64 = await readFileAsBase64(pendingFile);
      const newDoc: EmployeeDocument = {
        id: crypto.randomUUID(),
        employeeId: id,
        name: pendingFile.name,
        label: docLabel.trim(),
        type: pendingFile.type,
        size: pendingFile.size,
        data: base64,
        createdAt: new Date().toISOString(),
      };
      await addDocument(newDoc);
      toast({ title: "Document ajouté", description: `${docLabel} a été enregistré.` });
    } catch {
      toast({ title: "Erreur", description: "Impossible d'ajouter le document.", variant: "destructive" });
    }

    setShowDocDialog(false);
    setPendingFile(null);
    setDocLabel("");
  };

  const handleProfilePicClick = () => {
    profilePicInputRef.current?.click();
  };

  const handleProfilePicChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !employee) return;

    // Validate it's an image
    if (!file.type.startsWith('image/')) {
      toast({ title: "Erreur", description: "Veuillez sélectionner une image.", variant: "destructive" });
      return;
    }

    // Limit size to 2MB
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "Erreur", description: "L'image ne doit pas dépasser 2 Mo.", variant: "destructive" });
      return;
    }

    try {
      const base64 = await readFileAsBase64(file);
      await updateEmployee({ ...employee, profilePicture: base64 });
      toast({ title: "Photo mise à jour", description: "La photo de profil a été enregistrée." });
    } catch {
      toast({ title: "Erreur", description: "Impossible de mettre à jour la photo.", variant: "destructive" });
    }

    if (profilePicInputRef.current) {
      profilePicInputRef.current.value = '';
    }
  };

  const handleDownloadPayslip = (record: typeof payrollHistory[0]) => {
    if (!employee) return;
    
    downloadPayslip(
      { 
        firstName: employee.firstName, 
        lastName: employee.lastName, 
        matricule: employee.matricule, 
        position: employee.position,
        phone: employee.phone,
        cnssNumber: employee.cnssNumber,
        nif: employee.nif
      },
      {
        month: record.month,
        baseSalary: employee.baseSalary,
        grossEarnings: record.grossEarnings,
        netSalary: record.netSalary,
        cnssEmployee: record.cnssEmployee,
        amuEmployee: record.amuEmployee,
        irpp: record.irpp,
        components: employee.salaryComponents.map(c => ({ name: c.name, amount: c.amount })),
      },
      company
    );
    
    toast({ title: "Bulletin téléchargé", description: `Bulletin de ${record.month} généré.` });
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
  
  if (!employee) {
    return (
      <MainLayout>
        <div className="flex flex-col items-center justify-center h-96">
          <p className="text-muted-foreground mb-4">Employé non trouvé</p>
          <Button onClick={() => navigate('/employees')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour à la liste
          </Button>
        </div>
      </MainLayout>
    );
  }

  const department = departments.find(d => d.id === employee.departmentId);
  const payrollBreakdown = calculatePayroll({
    baseSalary: employee.baseSalary,
    components: employee.salaryComponents,
  });

  return (
    <MainLayout>
      <PageHeader 
        title=""
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => navigate('/employees')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour
            </Button>
            <Button onClick={handleEdit}>
              <Edit className="w-4 h-4 mr-2" />
              Modifier
            </Button>
          </div>
        }
      />

      {/* Employee Header */}
      <div className="flex items-start gap-6 mb-8">
        {/* Profile Picture */}
        <div 
          className="relative w-20 h-20 rounded-xl overflow-hidden cursor-pointer group"
          onClick={handleProfilePicClick}
        >
          {employee.profilePicture ? (
            <img 
              src={employee.profilePicture} 
              alt={`${employee.firstName} ${employee.lastName}`}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-primary/10 flex items-center justify-center">
              <span className="text-2xl font-bold text-primary">
                {employee.firstName[0]}{employee.lastName[0]}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Camera className="w-6 h-6 text-white" />
          </div>
          <input
            type="file"
            ref={profilePicInputRef}
            onChange={handleProfilePicChange}
            className="hidden"
            accept="image/*"
          />
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">
              {employee.firstName} {employee.lastName}
            </h1>
            <StatusBadge status={employee.status} />
          </div>
          <p className="text-muted-foreground mb-1">{employee.position}</p>
          <p className="text-sm text-muted-foreground font-mono">{employee.matricule}</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Salaire net</p>
          <p className="text-2xl font-bold text-primary">{formatCFA(payrollBreakdown.netSalary)}</p>
        </div>
      </div>

      <Tabs defaultValue="info" className="space-y-6">
        <TabsList>
          <TabsTrigger value="info">Informations</TabsTrigger>
          <TabsTrigger value="salary">Salaire</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="history">Historique paie</TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Personal Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informations personnelles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{employee.email}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{employee.phone}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    Né(e) le {new Date(employee.dateOfBirth).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                {employee.address && (
                  <div className="text-sm text-muted-foreground">
                    {employee.address}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Employment Info */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Informations professionnelles</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{department?.name || '-'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    Embauché(e) le {new Date(employee.hireDate).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">CNSS: {employee.cnssNumber || '-'}</span>
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">NIF: </span>
                  {employee.nif || '-'}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Banque: </span>
                  {employee.bankName || '-'}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="salary">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PayrollBreakdownCard breakdown={payrollBreakdown} />
            
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Composantes salariales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b">
                    <span className="font-medium">Salaire de base</span>
                    <span className="font-bold">{formatCFA(employee.baseSalary)}</span>
                  </div>
                  {employee.salaryComponents.map((comp) => (
                    <div key={comp.id} className="flex justify-between items-center py-2 border-b last:border-0">
                      <div>
                        <p className="text-sm font-medium">{comp.name}</p>
                        <div className="flex gap-2 mt-1">
                          {comp.isTaxable && (
                            <span className="text-xs bg-destructive/10 text-destructive px-1.5 py-0.5 rounded">
                              IRPP
                            </span>
                          )}
                          {comp.includedInCNSS && (
                            <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                              CNSS
                            </span>
                          )}
                          {comp.includedInAMU && (
                            <span className="text-xs bg-accent/10 text-accent-foreground px-1.5 py-0.5 rounded">
                              AMU
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="font-medium">{formatCFA(comp.amount)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="documents">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Documents</CardTitle>
            </CardHeader>
            <CardContent>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
              />
              <div className="space-y-3">
                {loadingDocs ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : documents.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Aucun document enregistré
                  </p>
                ) : (
                  documents.map((doc) => (
                    <div key={doc.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <FileText className="w-5 h-5 text-muted-foreground" />
                        <div>
                          <span className="text-sm font-medium">{doc.label || doc.name}</span>
                          <p className="text-xs text-muted-foreground">
                            {doc.name} • {(doc.size / 1024).toFixed(1)} Ko • {new Date(doc.createdAt).toLocaleDateString('fr-FR')}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleDownloadDoc(doc)}>
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteDoc(doc)}>
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
                <Button variant="outline" className="w-full mt-4" onClick={handleAddDocument}>
                  <Upload className="w-4 h-4 mr-2" />
                  Ajouter un document
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Historique des bulletins</CardTitle>
            </CardHeader>
            <CardContent>
              {payrollHistory.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  Aucun bulletin de paie disponible
                </p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Période</th>
                      <th className="text-right">Brut</th>
                      <th className="text-right">Net</th>
                      <th>Statut</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrollHistory.map((record) => (
                      <tr key={record.id}>
                        <td className="font-medium">
                          {new Date(record.month + '-01').toLocaleDateString('fr-FR', { 
                            month: 'long', 
                            year: 'numeric' 
                          })}
                        </td>
                        <td className="text-right">{formatCFA(record.grossEarnings)}</td>
                        <td className="text-right font-semibold">{formatCFA(record.netSalary)}</td>
                        <td>
                          {record.isValidated ? (
                            <span className="status-active">Validé</span>
                          ) : (
                            <span className="status-suspended">En attente</span>
                          )}
                        </td>
                        <td>
                          <Button variant="ghost" size="sm" onClick={() => handleDownloadPayslip(record)}>
                            <Download className="w-4 h-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Document Naming Dialog */}
      <Dialog open={showDocDialog} onOpenChange={setShowDocDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nommer le document</DialogTitle>
            <DialogDescription>
              Donnez un nom descriptif à ce document (ex: Contrat de travail, Pièce d'identité, etc.)
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="doc-label">Nom du document</Label>
              <Input
                id="doc-label"
                value={docLabel}
                onChange={(e) => setDocLabel(e.target.value)}
                placeholder="Ex: Contrat de travail"
              />
            </div>
            {pendingFile && (
              <p className="text-sm text-muted-foreground">
                Fichier: {pendingFile.name} ({(pendingFile.size / 1024).toFixed(1)} Ko)
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => {
              setShowDocDialog(false);
              setPendingFile(null);
              setDocLabel("");
            }}>
              Annuler
            </Button>
            <Button onClick={handleConfirmAddDocument} disabled={!docLabel.trim()}>
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
