import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import logo from '../../assets/shunya-logo.svg';
import MoireBackground from '../MoireBackground';
import './shared-ui.css';

export function Button({ to, variant = 'primary', className = '', children, ...props }) {
  const classes = `zh-button zh-button-${variant} ${className}`;
  return to ? <Link to={to} className={classes} {...props}>{children}</Link>
    : <button type="button" className={classes} {...props}>{children}</button>;
}
export function PageShell({ children, className = '', intensity = 'subtle', pattern = 'moire' }) {
  return <main className={`page zh-page-shell ${className}`}>{children}<MoireBackground intensity={intensity} pattern={pattern} /></main>;
}
export function AccessBrand() {
  return <div className="access-brand"><img src={logo} width="56" height="56" alt="SHUNYA" /><p className="eyebrow">SHUNYA · ZEROHOUR</p></div>;
}
export function AuthLayout({ title, description, children, onSubmit, footer }) {
  return <PageShell className="zh-auth-shell" intensity="medium">
    <section className="panel zh-auth-card"><AccessBrand /><h1>{title}</h1><p className="muted">{description}</p>
      <form onSubmit={onSubmit}>{children}</form>{footer && <div className="zh-auth-footer">{footer}</div>}
    </section>
  </PageShell>;
}
export function LogoutButton({ className = '' }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [pending, setPending] = useState(false);
  return <Button variant="secondary" className={className} disabled={pending} onClick={async () => {
    setPending(true);
    try { await signOut(); navigate('/', { replace: true }); }
    catch { setPending(false); /* The central guard displays the safe retry state. */ }
  }}>{pending ? 'Signing out…' : 'Log out'}</Button>;
}
