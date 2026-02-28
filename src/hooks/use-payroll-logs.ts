import { useState, useEffect, useCallback } from "react";
import { 
  PayrollModificationLog, 
  getLogsForPayrollRecord, 
  getLogsForEmployee,
  addPayrollModificationLog as addLog
} from "@/lib/payroll-logs";

export function usePayrollLogs(payrollRecordId?: string) {
  const [logs, setLogs] = useState<PayrollModificationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!payrollRecordId) {
      setLogs([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const result = await getLogsForPayrollRecord(payrollRecordId);
      setLogs(result);
    } catch (error) {
      console.error("Failed to fetch payroll logs:", error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [payrollRecordId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addModificationLog = useCallback(async (
    log: Omit<PayrollModificationLog, "id" | "modifiedAt">
  ) => {
    const newLog = await addLog(log);
    setLogs(prev => [newLog, ...prev]);
    return newLog;
  }, []);

  return { logs, loading, refresh, addModificationLog };
}

export function useEmployeePayrollLogs(employeeId?: string) {
  const [logs, setLogs] = useState<PayrollModificationLog[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!employeeId) {
      setLogs([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    try {
      const result = await getLogsForEmployee(employeeId);
      setLogs(result);
    } catch (error) {
      console.error("Failed to fetch employee payroll logs:", error);
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [employeeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { logs, loading, refresh };
}
