// Payroll modification logs system - uses IndexedDB via local-storage.ts

import { getAll, add, getByIndex, clearStore } from "./local-storage";

export interface PayrollModificationLog {
  id: string;
  payrollRecordId: string;
  employeeId: string;
  month: string;
  modifiedAt: string;
  modifiedBy: string;
  note: string;
  changes: {
    field: string;
    oldValue: number | string;
    newValue: number | string;
  }[];
}

// Get all modification logs
export async function getPayrollModificationLogs(): Promise<PayrollModificationLog[]> {
  try {
    return await getAll("payrollLogs");
  } catch {
    return [];
  }
}

// Get logs for a specific payroll record
export async function getLogsForPayrollRecord(payrollRecordId: string): Promise<PayrollModificationLog[]> {
  try {
    const logs = await getByIndex("payrollLogs", "payrollRecordId", payrollRecordId);
    return logs.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
  } catch {
    return [];
  }
}

// Get logs for a specific employee
export async function getLogsForEmployee(employeeId: string): Promise<PayrollModificationLog[]> {
  try {
    const logs = await getByIndex("payrollLogs", "employeeId", employeeId);
    return logs.sort((a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime());
  } catch {
    return [];
  }
}

// Add a new modification log
export async function addPayrollModificationLog(log: Omit<PayrollModificationLog, "id" | "modifiedAt">): Promise<PayrollModificationLog> {
  const newLog: PayrollModificationLog = {
    ...log,
    id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    modifiedAt: new Date().toISOString(),
  };
  
  await add("payrollLogs", newLog);
  
  return newLog;
}

// Clear all logs (for development/testing)
export async function clearAllLogs(): Promise<void> {
  await clearStore("payrollLogs");
}

// Export logs for backup
export async function exportLogs(): Promise<string> {
  const logs = await getPayrollModificationLogs();
  return JSON.stringify(logs);
}

// Import logs from backup
export async function importLogs(jsonData: string): Promise<void> {
  try {
    const logs = JSON.parse(jsonData);
    if (Array.isArray(logs)) {
      for (const log of logs) {
        await add("payrollLogs", log);
      }
    }
  } catch (e) {
    console.error("Failed to import logs:", e);
  }
}
