import { lazy, Suspense, type ReactNode } from "react";
import { Route } from "react-router-dom";
import ProtectedRoute from "@/components/ProtectedRoute";

// Carga diferida: MapLibre y las pantallas de Buky no pesan en la web actual.
const BukyLayout = lazy(() => import("./components/BukyLayout"));
const Inicio = lazy(() => import("./pages/Inicio"));
const Treino = lazy(() => import("./pages/Treino"));
const Resumo = lazy(() => import("./pages/Resumo"));
const Bolsa = lazy(() => import("./pages/Bolsa"));
const Sorteios = lazy(() => import("./pages/Sorteios"));
const Fotos = lazy(() => import("./pages/Fotos"));
const Patrocinio = lazy(() => import("./pages/Patrocinio"));
const Campanha = lazy(() => import("./pages/Campanha"));
const Avisos = lazy(() => import("./pages/Avisos"));
const Perfil = lazy(() => import("./pages/Perfil"));
const TreinoDetalhe = lazy(() => import("./pages/TreinoDetalhe"));
const Saldo = lazy(() => import("./pages/Saldo"));
const CompletarPerfil = lazy(() => import("./pages/CompletarPerfil"));
const CriarRota = lazy(() => import("./pages/CriarRota"));
const Entrar = lazy(() => import("./pages/Entrar"));
const Cadastro = lazy(() => import("./pages/Cadastro"));
const Loja = lazy(() =>
  import("./pages/loja/LojaHome").then((m) => ({ default: m.Loja })),
);
const Produto = lazy(() =>
  import("./pages/loja/Produto").then((m) => ({ default: m.Produto })),
);
const Carrinho = lazy(() =>
  import("./pages/loja/Carrinho").then((m) => ({ default: m.Carrinho })),
);
const Pedidos = lazy(() =>
  import("./pages/loja/Pedidos").then((m) => ({ default: m.Pedidos })),
);
const Pedido = lazy(() =>
  import("./pages/loja/Pedido").then((m) => ({ default: m.Pedido })),
);
const AdminBuky = lazy(() => import("./admin/AdminBuky"));

const Loading = () => (
  <div className="flex min-h-svh items-center justify-center bg-[#050505]">
    <span className="h-8 w-8 animate-spin rounded-full border-2 border-[#39ff14] border-t-transparent" />
  </div>
);

const S = ({ children }: { children: ReactNode }) => (
  <Suspense fallback={<Loading />}>{children}</Suspense>
);

/** Rutas de la app del atleta. Se insertan dentro de <Routes> en App.tsx. */
export const bukyRoutes = (
  <>
    <Route
      path="/entrar"
      element={
        <S>
          <Entrar />
        </S>
      }
    />
    <Route
      path="/cadastro"
      element={
        <S>
          <Cadastro />
        </S>
      }
    />
    <Route path="/app/loja" element={<S><BukyLayout /></S>}>
      <Route index element={<S><Loja /></S>} />
    </Route>
    <Route
      path="/app"
      element={
        <ProtectedRoute>
          <S>
            <BukyLayout />
          </S>
        </ProtectedRoute>
      }
    >
      <Route
        index
        element={
          <S>
            <Inicio />
          </S>
        }
      />
      <Route
        path="treino"
        element={
          <S>
            <Treino />
          </S>
        }
      />
      <Route
        path="treino/resumo"
        element={
          <S>
            <Resumo />
          </S>
        }
      />
      <Route
        path="bolsa"
        element={
          <S>
            <Bolsa />
          </S>
        }
      />
      <Route
        path="bolsa/sorteios"
        element={
          <S>
            <Sorteios />
          </S>
        }
      />
      <Route
        path="fotos"
        element={
          <S>
            <Fotos />
          </S>
        }
      />
      <Route
        path="patrocinio"
        element={
          <S>
            <Patrocinio />
          </S>
        }
      />
      <Route
        path="patrocinio/:id"
        element={
          <S>
            <Campanha />
          </S>
        }
      />
      <Route
        path="avisos"
        element={
          <S>
            <Avisos />
          </S>
        }
      />
      <Route
        path="sorteios"
        element={
          <S>
            <Sorteios />
          </S>
        }
      />
      <Route
        path="loja/produto/:slug"
        element={
          <S>
            <Produto />
          </S>
        }
      />
      <Route
        path="loja/carrinho"
        element={
          <S>
            <Carrinho />
          </S>
        }
      />
      <Route
        path="loja/pedidos"
        element={
          <S>
            <Pedidos />
          </S>
        }
      />
      <Route
        path="loja/pedido/:id"
        element={
          <S>
            <Pedido />
          </S>
        }
      />
      <Route
        path="perfil"
        element={
          <S>
            <Perfil />
          </S>
        }
      />
      <Route
        path="perfil/treino/:id"
        element={
          <S>
            <TreinoDetalhe />
          </S>
        }
      />
      <Route
        path="perfil/saldo"
        element={
          <S>
            <Saldo />
          </S>
        }
      />
      <Route
        path="completar"
        element={
          <S>
            <CompletarPerfil />
          </S>
        }
      />
      <Route
        path="rotas/nova"
        element={
          <S>
            <CriarRota />
          </S>
        }
      />
    </Route>
  </>
);

/** Sección Buky del admin (dentro de AdminLayout, protegida como admin). */
export const BukyAdminRoute = () => (
  <S>
    <AdminBuky />
  </S>
);
