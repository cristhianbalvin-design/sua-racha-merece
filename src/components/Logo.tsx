const Logo = ({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) => {
  const sizes = {
    sm: 'text-xl',
    md: 'text-3xl',
    lg: 'text-display',
  };

  return (
    <span className={`font-display font-bold italic ${sizes[size]} tracking-tight`}>
      <span className="text-primary">3</span>
      <span className="text-foreground">BUK</span>
    </span>
  );
};

export default Logo;
