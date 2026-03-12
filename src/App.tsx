import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import PlanSelection from "./pages/PlanSelection";
import CompleteProfile from "./pages/CompleteProfile";
import Dashboard from "./pages/Dashboard";
import CampaignDetail from "./pages/CampaignDetail";
import SubmitEvidence from "./pages/SubmitEvidence";
import UserProfile from "./pages/UserProfile";
import UserParticipations from "./pages/UserParticipations";
import UserNotifications from "./pages/UserNotifications";
import Winners from "./pages/Winners";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminCreateCampaign from "./pages/admin/AdminCreateCampaign";
import AdminParticipations from "./pages/admin/AdminParticipations";
import AdminReports from "./pages/admin/AdminReports";
import UserLayout from "./components/UserLayout";
import AdminLayout from "./components/AdminLayout";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/registro" element={<Register />} />
          <Route path="/plano" element={<PlanSelection />} />
          <Route path="/completar-perfil" element={<CompleteProfile />} />

          {/* User (with layout) */}
          <Route element={<UserLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/campanhas" element={<Dashboard />} />
            <Route path="/campanha/:id" element={<CampaignDetail />} />
            <Route path="/campanha/:id/participar" element={<SubmitEvidence />} />
            <Route path="/participacoes" element={<UserParticipations />} />
            <Route path="/notificacoes" element={<UserNotifications />} />
            <Route path="/perfil" element={<UserProfile />} />
            <Route path="/ganhadores" element={<Winners />} />
          </Route>

          {/* Admin */}
          <Route path="/admin" element={<AdminLogin />} />
          <Route element={<AdminLayout />}>
            <Route path="/admin/usuarios" element={<AdminUsers />} />
            <Route path="/admin/campanhas" element={<AdminCreateCampaign />} />
            <Route path="/admin/participacoes" element={<AdminParticipations />} />
            <Route path="/admin/relatorios" element={<AdminReports />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
