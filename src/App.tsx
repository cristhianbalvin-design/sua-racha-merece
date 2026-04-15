import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./contexts/AuthContext";
import { initializeMockData } from "./lib/mockApi";

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
import AdminCampaigns from "./pages/admin/AdminCampaigns";
import AdminParticipations from "./pages/admin/AdminParticipations";
import AdminQualification from "./pages/admin/AdminQualification";
import AdminWinners from "./pages/admin/AdminWinners";
import AdminSports from "./pages/admin/AdminSports";
import AdminRegions from "./pages/admin/AdminRegions";
import AdminRelatorio from "./pages/admin/AdminRelatorio";
import AdminProfile from "./pages/admin/AdminProfile";
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserLayout from "./components/UserLayout";
import AdminLayout from "./components/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";

initializeMockData();

const queryClient = new QueryClient();

import { AnimatePresence } from "framer-motion";
import { PageTransition } from "./components/PageTransition";

const AnimatedRoutes = () => {
  const location = useLocation();
  
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        {/* Public */}
        <Route path="/" element={<PageTransition><Landing /></PageTransition>} />
        <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
        <Route path="/registro" element={<PageTransition><Register /></PageTransition>} />
        <Route path="/plano" element={<PageTransition><PlanSelection /></PageTransition>} />
        <Route path="/completar-perfil" element={<PageTransition><CompleteProfile /></PageTransition>} />

        {/* User (with layout) */}
        <Route element={<ProtectedRoute><UserLayout /></ProtectedRoute>}>
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
        <Route path="/admin" element={<PageTransition><AdminLogin /></PageTransition>} />
        <Route element={<ProtectedRoute requireAdmin={true}><AdminLayout /></ProtectedRoute>}>
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/relatorio" element={<AdminRelatorio />} />
          <Route path="/admin/perfil" element={<AdminProfile />} />
          <Route path="/admin/usuarios" element={<AdminUsers />} />
          <Route path="/admin/campanhas" element={<AdminCampaigns />} />
          <Route path="/admin/participacoes" element={<AdminParticipations />} />
          <Route path="/admin/qualificacao" element={<AdminQualification />} />
          <Route path="/admin/ganhadores" element={<AdminWinners />} />
          <Route path="/admin/esportes" element={<AdminSports />} />
          <Route path="/admin/regioes" element={<AdminRegions />} />
        </Route>

        <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
      </Routes>
    </AnimatePresence>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AnimatedRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
