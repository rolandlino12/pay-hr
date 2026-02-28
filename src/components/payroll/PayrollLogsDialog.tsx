import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { PayrollModificationLog } from "@/lib/payroll-logs";
import { formatCFA } from "@/lib/payroll-engine";
import { Clock, FileText, User } from "lucide-react";

interface PayrollLogsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  logs: PayrollModificationLog[];
  employeeName?: string;
}

export function PayrollLogsDialog({
  open,
  onOpenChange,
  logs,
  employeeName,
}: PayrollLogsDialogProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatMonthLabel = (monthStr: string) => {
    const date = new Date(`${monthStr}-01`);
    return date.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  };

  const formatValue = (value: number | string) => {
    if (typeof value === 'number') {
      return formatCFA(value);
    }
    return value;
  };

  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      grossEarnings: "Salaire brut",
      cnssEmployee: "CNSS employé",
      amuEmployee: "AMU employé",
      irpp: "IRPP",
      netSalary: "Net à payer",
    };
    return labels[field] || field;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Historique des modifications
          </DialogTitle>
          {employeeName && (
            <DialogDescription>
              Modifications pour {employeeName}
            </DialogDescription>
          )}
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          {logs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <FileText className="w-12 h-12 mx-auto mb-4 opacity-30" />
              <p>Aucune modification enregistrée</p>
            </div>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-muted-foreground" />
                      <span className="font-medium">{formatDate(log.modifiedAt)}</span>
                      <span className="text-muted-foreground">-</span>
                      <span className="text-muted-foreground">{formatMonthLabel(log.month)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <User className="w-3 h-3" />
                      {log.modifiedBy}
                    </div>
                  </div>

                  <div className="bg-muted/50 rounded p-3 text-sm">
                    <p className="font-medium text-muted-foreground mb-1">Motif :</p>
                    <p>{log.note}</p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase">Modifications :</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {log.changes.map((change, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between bg-background border rounded px-3 py-2 text-sm"
                        >
                          <span className="text-muted-foreground">{getFieldLabel(change.field)}</span>
                          <div className="flex items-center gap-2 font-mono">
                            <span className="text-destructive line-through text-xs">
                              {formatValue(change.oldValue)}
                            </span>
                            <span className="text-success">
                              {formatValue(change.newValue)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
