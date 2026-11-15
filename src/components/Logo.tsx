const Logo = ({ size = 'md', variant = 'dark' }: { size?: 'sm' | 'md' | 'lg'; variant?: 'dark' | 'light' }) => {
  const sizes = { sm: 24, md: 32, lg: 56 };
  return <img src={`/brand/logo-3buk-horizontal-${variant}.png`} alt="3buk" style={{ height: sizes[size], width: 'auto' }} />;
};

export default Logo;
