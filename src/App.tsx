import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useEffect } from "react";
import OneSignal from "react-onesignal";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Patrocinador from "./pages/Patrocinador";
import PatrocinadorAcesso from "./pages/PatrocinadorAcesso";
import { parseLinkError } from "./lib/sponsorAccess";
import { initializeMockData } from "./lib/mockApi";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Register from "./pages/Register";
import PublicCampaignPreview from "./pages/PublicCampaignPreview";
import CompleteProfile from "./pages/CompleteProfile";
import Dashboard from "./pages/Dashboard";
import CampaignDetail from "./pages/CampaignDetail";
import SubmitEvidence from "./pages/SubmitEvidence";
import UserProfile from "./pages/UserProfile";
import UserParticipations from "./pages/UserParticipations";
import UserNotifications from "./pages/UserNotifications";
import UserPhotos3buk from "./pages/UserPhotos3buk";
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
import AdminPopups from "./pages/admin/AdminPopups";
import AdminTerms from "./pages/admin/AdminTerms";
import AdminEventPhotos from "./pages/admin/AdminEventPhotos";
import AdminPhotographers from "./pages/admin/AdminPhotographers";
import AdminPhotoModeration from "./pages/admin/AdminPhotoModeration";
import AdminCredits from "./pages/admin/AdminCredits";
import UserCredits from "./pages/UserCredits";
import PremiumTerms from "./pages/PremiumTerms";
import UserLibrary from "./pages/UserLibrary";
import PhotographerPortal from "./pages/photographer/PhotographerPortal";
import PhotographerLogin from "./pages/photographer/PhotographerLogin";
import PhotographerTerms from "./pages/photographer/PhotographerTerms";
import PhotographerDashboard from "./pages/photographer/PhotographerDashboard";
import PhotographerUpload from "./pages/photographer/PhotographerUpload";
import PhotographerPhotos from "./pages/photographer/PhotographerPhotos";
import PhotographerLayout from "./components/photographer/PhotographerLayout";
import ProtectedPhotographerRoute from "./components/photographer/ProtectedPhotographerRoute";
import { SHOW_BUKY_APP, SHOW_FACE_SEARCH } from "./config/features";
import { IS_NATIVE } from "./lib/platform";
import { bukyRoutes, BukyAdminRoute } from "./features/buky/routes";
import UserLayout from "./components/UserLayout";
import AdminLayout from "./components/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

initializeMockData();

const queryClient = new QueryClient();

import { PageTransition } from "./components/PageTransition";

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <Routes location={location}>
      {/* App del atleta (Buky dentro de 3BUK). Con SHOW_BUKY_APP pasa a ser la entrada principal. */}
      {bukyRoutes}

      {/* Public */}
      <Route path="/" element={SHOW_BUKY_APP ? <Navigate to="/app" replace /> : <PageTransition><Landing /></PageTransition>} />
      <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
      <Route path="/forgot-password" element={<PageTransition><ForgotPassword /></PageTransition>} />
      <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
      <Route path="/registro" element={<PageTransition><Register /></PageTransition>} />
      <Route path="/termos-premium" element={<PageTransition><PremiumTerms /></PageTransition>} />
      <Route path="/c/:id" element={<PageTransition><PublicCampaignPreview /></PageTransition>} />
      {/* Plans are kept in code but hidden from the current onboarding flow. */}
      <Route path="/plano" element={<Navigate to="/completar-perfil" replace />} />
      <Route path="/completar-perfil" element={<PageTransition><CompleteProfile /></PageTransition>} />

      <Route path="/patrocinador/acesso" element={<PatrocinadorAcesso />} />
      <Route path="/patrocinador" element={parseLinkError(location.search, location.hash) ? <Navigate to={`/patrocinador/acesso${location.search}${location.hash}`} replace /> : <ProtectedRoute><Patrocinador /></ProtectedRoute>} />
      <Route path="/patrocinador/validar/:token" element={<ProtectedRoute><Patrocinador /></ProtectedRoute>} />

      {/* User (with layout) */}
      <Route element={<ProtectedRoute><UserLayout /></ProtectedRoute>}>
        <Route path="/dashboard" element={SHOW_BUKY_APP ? <Navigate to="/app" replace /> : <Dashboard />} />
        <Route path="/campanhas" element={<Dashboard />} />
        <Route path="/campanha/:id" element={<CampaignDetail />} />
        <Route path="/campanha/:id/participar" element={<SubmitEvidence />} />
        <Route path="/participacoes" element={<UserParticipations />} />
        <Route path="/fotografias-3buk" element={<UserPhotos3buk />} />
        <Route path="/notificacoes" element={<UserNotifications />} />
        <Route path="/perfil" element={<UserProfile />} />
        <Route path="/ganhadores" element={<Winners />} />
        {SHOW_FACE_SEARCH && <Route path="/creditos" element={<UserCredits />} />}
        {SHOW_FACE_SEARCH && <Route path="/biblioteca" element={<UserLibrary />} />}
      </Route>

      {/* Portal do Fotógrafo (atrás do flag SHOW_FACE_SEARCH) */}
      {SHOW_FACE_SEARCH && (
        <Route path="/fotografo" element={<PhotographerPortal />}>
          <Route path="login" element={<PhotographerLogin />} />
          <Route
            path="termos"
            element={<ProtectedPhotographerRoute allowPendingTerms><PhotographerTerms /></ProtectedPhotographerRoute>}
          />
          <Route element={<ProtectedPhotographerRoute><PhotographerLayout /></ProtectedPhotographerRoute>}>
            <Route index element={<PhotographerDashboard />} />
            <Route path="enviar" element={<PhotographerUpload />} />
            <Route path="fotos" element={<PhotographerPhotos />} />
          </Route>
        </Route>
      )}

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
        <Route path="/admin/popups" element={<AdminPopups />} />
        <Route path="/admin/esportes" element={<AdminSports />} />
        <Route path="/admin/regioes" element={<AdminRegions />} />
        <Route path="/admin/termos" element={<AdminTerms />} />
        {/* The component internally redirects if flag is off */}
        <Route path="/admin/fotos" element={<AdminEventPhotos />} />
        <Route path="/admin/fotos/moderacao" element={<AdminPhotoModeration />} />
        <Route path="/admin/fotografos" element={<AdminPhotographers />} />
        <Route path="/admin/creditos" element={<AdminCredits />} />
        <Route path="/admin/buky/*" element={<BukyAdminRoute />} />
      </Route>

      <Route path="*" element={<PageTransition><NotFound /></PageTransition>} />
    </Routes>
  );
};

let oneSignalReady: Promise<void> | undefined;
let identityQueue: Promise<void> = Promise.resolve();
function PushIdentity() {
  const { user, loading } = useAuth();
  useEffect(() => {
    if (IS_NATIVE || loading) return;
    let cancelled = false;
    oneSignalReady ??= OneSignal.init({ appId: "f4c2d37d-d6a4-4209-9814-cf2c9cce92e1", serviceWorkerPath: "sw.js", allowLocalhostAsSecureOrigin: true });
    identityQueue = identityQueue.catch(console.error).then(async () => { await oneSignalReady; if (!cancelled) { if (user?.id) await OneSignal.login(user.id); else await OneSignal.logout(); } }).catch(console.error);
    return () => { cancelled = true; };
  }, [user?.id, loading]);
  return null;
}

const App = () => {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <PushIdentity />
          <Toaster />
          <Sonner />
          {!IS_NATIVE && <PWAInstallPrompt />}
          <AnimatedRoutes />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </BrowserRouter>
  );
};

export default App;
