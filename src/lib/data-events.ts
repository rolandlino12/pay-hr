// Simple event emitter for data synchronization across hooks
type Listener = () => void;

class DataEventEmitter {
  private listeners: Map<string, Set<Listener>> = new Map();

  subscribe(event: string, listener: Listener): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
    
    // Return unsubscribe function
    return () => {
      this.listeners.get(event)?.delete(listener);
    };
  }

  emit(event: string): void {
    this.listeners.get(event)?.forEach(listener => listener());
  }
}

export const dataEvents = new DataEventEmitter();

// Event names
export const DATA_EVENTS = {
  EMPLOYEES_CHANGED: 'employees-changed',
  DEPARTMENTS_CHANGED: 'departments-changed',
  PAYROLL_CHANGED: 'payroll-changed',
} as const;
