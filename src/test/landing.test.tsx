import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';

const mocks = vi.hoisted(() => ({
  user: null as null | { email: string },
  login: vi.fn(),
  google: vi.fn(),
  rpc: vi.fn(),
  winners: vi.fn(),
  popup: vi.fn(),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: mocks.user, login: mocks.login, loginWithGoogle: mocks.google }),
}));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc } }));
vi.mock('@/lib/mockApi', () => ({ apiGetWinners: mocks.winners, apiGetActiveHomePopup: mocks.popup }));
function show(element: React.ReactNode, path = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="*" element={element} />
          <Route path="/dashboard" element={<div>Dashboard destino</div>} />
          <Route path="/app/fotos" element={<div>Fotos destino</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
beforeEach(() => {
  mocks.user = null;
  mocks.login.mockReset().mockResolvedValue(undefined);
  mocks.google.mockReset();
  mocks.rpc
    .mockReset()
    .mockResolvedValue({ data: { mode: 'manual', contact_email: 'pagamentos@3buk.com' }, error: null });
  mocks.winners.mockReset().mockResolvedValue([]);
  mocks.popup.mockReset().mockResolvedValue(null);
  sessionStorage.clear();
});
afterEach(cleanup);
describe('Landing', () => {
  it('renderiza hero, acesso e planos sem conteúdo vazio ou marketplace', async () => {
    show(<Landing />);
    expect(screen.getByRole('heading', { name: /pegue bukys/i })).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'FREEMIUM' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'PREMIUM' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/pagamentos@3buk.com/)).toHaveAttribute('href', 'mailto:pagamentos@3buk.com'),
    );
    expect(screen.queryByText(/ganhadores das últimas campanhas/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/quem vive, conta/i)).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/Marketplace|Produtos 3buk|Parceiros/i);
    expect(screen.getByRole('link', { name: /buscar fotos/i })).toHaveAttribute(
      'href',
      '/login?redirectTo=/app/fotos',
    );
  });
  it('abre apenas uma resposta e permite fechá-la', () => {
    show(<Landing />);
    const first = screen.getByRole('button', { name: 'Como funciona o Buky?' });
    const second = screen.getByRole('button', { name: 'O que é o Freemium?' });
    fireEvent.click(first);
    expect(first).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(second);
    expect(first).toHaveAttribute('aria-expanded', 'false');
    expect(second).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(second);
    expect(second).toHaveAttribute('aria-expanded', 'false');
  });
  it('usa e-mail de respaldo se o RPC falhar', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error('offline') });
    show(<Landing />);
    await waitFor(() =>
      expect(screen.getByText('contato@3buk.com', { selector: 'a' })).toHaveAttribute(
        'href',
        'mailto:contato@3buk.com',
      ),
    );
  });
  it('envia usuário conectado à busca de fotos', () => {
    mocks.user = { email: 'atleta@example.com' };
    show(<Landing />);
    expect(screen.getByRole('link', { name: /buscar fotos/i })).toHaveAttribute('href', '/app/fotos');
  });
  it('usa a lógica de login compartilhada', async () => {
    show(<Landing />);
    fireEvent.change(screen.getByLabelText('E-mail'), { target: { value: 'atleta@example.com' } });
    fireEvent.change(screen.getByLabelText('Senha'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /entrar →/i }));
    await waitFor(() => expect(mocks.login).toHaveBeenCalledWith('atleta@example.com', '123456'));
    expect(await screen.findByText('Dashboard destino')).toBeInTheDocument();
  });
});
describe('Login', () => {
  it('mantém o redirecionamento solicitado', async () => {
    show(<Login />, '/login?redirectTo=/app/fotos');
    const inputs = document.querySelectorAll('input');
    fireEvent.change(inputs[0], { target: { value: 'atleta@example.com' } });
    fireEvent.change(inputs[1], { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: 'ENTRAR' }));
    expect(await screen.findByText('Fotos destino')).toBeInTheDocument();
  });
});
