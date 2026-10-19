import { Outlet } from 'react-router-dom';
import PhotographerProvider from '@/components/photographer/PhotographerProvider';

/** Raiz das rotas /fotografo: estado do fotógrafo compartilhado por todas as telas. */
const PhotographerPortal = () => (
  <PhotographerProvider>
    <Outlet />
  </PhotographerProvider>
);

export default PhotographerPortal;
