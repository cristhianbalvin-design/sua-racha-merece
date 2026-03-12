import { Outlet } from 'react-router-dom';
import MobileNav from './MobileNav';
import DesktopHeader from './DesktopHeader';

const UserLayout = () => {
  return (
    <div className="min-h-svh bg-background">
      <DesktopHeader />
      <main className="pb-20 md:pb-8">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  );
};

export default UserLayout;
