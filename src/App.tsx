import { Toaster } from "@/components/ui/toaster";
import { UserProvider } from "@/contexts/UserContext";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, HashRouter, Routes, Route } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import Employees from "./pages/Employees";
import NewEmployee from "./pages/NewEmployee";
import EditEmployee from "./pages/EditEmployee";
import EmployeeProfile from "./pages/EmployeeProfile";
import Departments from "./pages/Departments";
import Payroll from "./pages/Payroll";
import Advances from "./pages/Advances";
import Payslips from "./pages/Payslips";
import Reports from "./pages/Reports";
import Accounting from "./pages/Accounting";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const isTauri =
  typeof window !== "undefined" &&
  !!(window as any).__TAURI__;

const Router = isTauri ? HashRouter : BrowserRouter;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <UserProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Router>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/employees/new" element={<NewEmployee />} />
            <Route path="/employees/:id" element={<EmployeeProfile />} />
            <Route path="/employees/:id/edit" element={<EditEmployee />} />
            <Route path="/departments" element={<Departments />} />
            <Route path="/payroll" element={<Payroll />} />
            <Route path="/advances" element={<Advances />} />
            <Route path="/payslips" element={<Payslips />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/accounting" element={<Accounting />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </TooltipProvider>
    </UserProvider>
  </QueryClientProvider>
);

export default App;
