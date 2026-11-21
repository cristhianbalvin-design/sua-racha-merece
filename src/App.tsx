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
import { getAuthRedirectFromLocation } from './lib/authRedirect';
import { legacyRedirects } from './lib/legacyRedirects';
import { NativeDeepLinks } from './features/buky/components/NativeDeepLinks';
import { parseLinkError } from "./lib/sponsorAccess";
import { initializeMockData } from "./lib/mockApi";

import Landing from "./pages/Landing";
import Institucional from "./pages/Institucional";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import PublicCampaignPreview from "./pages/PublicCampaignPreview";
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
import PremiumTerms from "./pages/PremiumTerms";
import PhotographerPortal from "./pages/photographer/PhotographerPortal";
import PhotographerLogin from "./pages/photographer/PhotographerLogin";
import PhotographerTerms from "./pages/photographer/PhotographerTerms";
import PhotographerDashboard from "./pages/photographer/PhotographerDashboard";
import PhotographerUpload from "./pages/photographer/PhotographerUpload";
import PhotographerPhotos from "./pages/photographer/PhotographerPhotos";
import PhotographerLayout from "./components/photographer/PhotographerLayout";
import ProtectedPhotographerRoute from "./components/photographer/ProtectedPhotographerRoute";
import { SHOW_FACE_SEARCH } from "./config/features";
import { IS_NATIVE } from "./lib/platform";
import { bukyRoutes, BukyAdminRoute } from "./features/buky/routes";
import AdminLayout from "./components/AdminLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import NotFound from "./pages/NotFound";
import PWAInstallPrompt from "./components/PWAInstallPrompt";

initializeMockData();

const queryClient = new QueryClient();

import { PageTransition } from "./components/PageTransition";

function LoginRedirect() {
  const location = useLocation();
  const redirect = getAuthRedirectFromLocation(location);
  return <Navigate to={`/${redirect ? `?redirect=${encodeURIComponent(redirect)}` : ''}#acesso`} replace />;
}

const AnimatedRoutes = () => {
  const location = useLocation();

  return (
    <Routes location={location}>
      {/* App del atleta (Buky dentro de 3BUK). Con SHOW_BUKY_APP pasa a ser la entrada principal. */}
      {bukyRoutes}

      {/* Public */}
      <Route path="/" element={IS_NATIVE ? <Navigate to="/app" replace /> : <PageTransition><Landing /></PageTransition>} />
      <Route path="/sobre" element={<Institucional page="sobre" />} />
      <Route path="/regulamento" element={<Institucional page="regulamento" />} />
      <Route path="/contato" element={<Institucional page="contato" />} />
      <Route path="/login" element={<LoginRedirect />} />
      <Route path="/forgot-password" element={<PageTransition><ForgotPassword /></PageTransition>} />
      <Route path="/reset-password" element={<PageTransition><ResetPassword /></PageTransition>} />
      <Route path="/registro" element={<Navigate to={`/cadastro${location.search}`} replace state={location.state} />} />
      <Route path="/termos-premium" element={<PageTransition><PremiumTerms /></PageTransition>} />
      <Route path="/c/:id" element={<PageTransition><PublicCampaignPreview /></PageTransition>} />

      <Route path="/patrocinador/acesso" element={<PatrocinadorAcesso />} />
      <Route path="/patrocinador" element={parseLinkError(location.search, location.hash) ? <Navigate to={`/patrocinador/acesso${location.search}${location.hash}`} replace /> : <ProtectedRoute><Patrocinador /></ProtectedRoute>} />
      <Route path="/patrocinador/validar/:token" element={<ProtectedRoute><Patrocinador /></ProtectedRoute>} />

      {legacyRedirects.map(([from, to]) => <Route key={from} path={from} element={<Navigate to={to} replace />} />)}

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
          <NativeDeepLinks />
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
