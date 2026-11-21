import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaceBanner } from '@/components/landing/FaceBanner';
import { Faq } from '@/components/landing/Faq';
import { Footer } from '@/components/landing/Footer';
import { Header } from '@/components/landing/Header';
import { Hero } from '@/components/landing/Hero';
import { Plans } from '@/components/landing/Plans';
import { Testimonials } from '@/components/landing/Testimonials';
import { Winners } from '@/components/landing/Winners';
import type { HomePopup, Winner } from '@/data/mockData';
import { apiGetActiveHomePopup, apiGetWinners } from '@/lib/mockApi';
import '@/components/landing/landing.css';

export default function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const [winners, setWinners] = useState<Winner[]>([]);
  const [popup, setPopup] = useState<HomePopup | null>(null);
  useEffect(() => {
    if (
      !window.location.hash && (
        window.matchMedia('(display-mode: standalone)').matches ||
        (navigator as Navigator & { standalone?: boolean }).standalone
      )
    ) {
      navigate('/app', { replace: true });
      return;
    }
    apiGetWinners()
      .then((data) => setWinners([...data].reverse().slice(0, 6)))
      .catch(() => setWinners([]));
    apiGetActiveHomePopup()
      .then((data) => {
        if (data && !sessionStorage.getItem(`home-popup-dismissed-${data.id}`)) setPopup(data);
      })
      .catch(() => {});
  }, [navigate]);
  useEffect(() => {
    if (location.hash === '#acesso') {
      document.getElementById('acesso')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('landing-email')?.focus();
    }
  }, [location.hash, location.search]);
  const close = () => {
    if (popup) sessionStorage.setItem(`home-popup-dismissed-${popup.id}`, 'true');
    setPopup(null);
  };
  return (
    <div className="landing-3buk">
      {popup && (
        <div className="l-popup" role="dialog" aria-modal="true" aria-label={popup.name}>
          <div>
            <button className="l-popup-close" onClick={close} aria-label="Fechar popup">
              <X />
            </button>
            <img src={popup.imageUrl} alt={popup.name} width="860" height="645" />
            <div className="l-popup-actions">
              <Link className="l-button" to="/registro" onClick={close}>
                REGISTRAR NOVO USUÁRIO
              </Link>
              <Link className="l-button l-outline" to="/login" onClick={close}>
                INICIAR SESSÃO
              </Link>
            </div>
          </div>
        </div>
      )}
      <Header />
      <main>
        <Hero />
        <FaceBanner />
        <Plans />
        <Testimonials />
        <Faq />
        <Winners winners={winners} />
      </main>
      <Footer />
    </div>
  );
}
