import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth';
import { useI18n } from '../i18n';
import { Card, ErrorBox, Notice } from '../components';

export default function LoginScreen(): JSX.Element {
  const { login, register, loginDemo } = useAuth();
  const { t, locale } = useI18n();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [country, setCountry] = useState('SN');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === 'login') await login(email.trim(), password);
      else await register({ email: email.trim(), password, fullName: fullName.trim(), country, locale });
      navigate(from, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Connexion impossible.', 'Sign-in failed.'));
    } finally {
      setBusy(false);
    }
  }

  async function demo(): Promise<void> {
    setBusy(true);
    setError(null);
    try {
      await loginDemo();
      navigate('/', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('Mode démonstration indisponible.', 'Demo mode unavailable.'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="content" style={{ maxWidth: 560, paddingTop: 40 }}>
      <div className="brand" style={{ marginBottom: 18 }}>
        <span className="brand-mark">X</span>
        <span>
          XAMOTO
          <small>{t('Connaître sa voiture.', 'Know your car.')}</small>
        </span>
      </div>

      <Card title={mode === 'login' ? t('Connexion', 'Sign in') : t('Créer un compte', 'Create an account')}>
        <ErrorBox message={error} />
        <form onSubmit={submit}>
          {mode === 'register' && (
            <>
              <label htmlFor="fullName">{t('Nom complet', 'Full name')}</label>
              <input id="fullName" value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} />
              <label htmlFor="country">{t('Pays', 'Country')}</label>
              <select id="country" value={country} onChange={(event) => setCountry(event.target.value)}>
                <option value="SN">Sénégal</option>
                <option value="CI">Côte d’Ivoire</option>
                <option value="ML">Mali</option>
                <option value="BF">Burkina Faso</option>
                <option value="CM">Cameroun</option>
                <option value="FR">France</option>
                <option value="OT">Autre</option>
              </select>
            </>
          )}

          <label htmlFor="email">{t('Adresse e-mail', 'E-mail address')}</label>
          <input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoComplete="email" />

          <label htmlFor="password">{t('Mot de passe', 'Password')}</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />

          <div className="row" style={{ marginTop: 16 }}>
            <button className="button primary" type="submit" disabled={busy}>
              {busy ? t('Traitement…', 'Working…') : mode === 'login' ? t('Se connecter', 'Sign in') : t('Créer le compte', 'Create account')}
            </button>
            <button
              className="button ghost"
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login');
                setError(null);
              }}
            >
              {mode === 'login' ? t('Créer un compte', 'Create an account') : t('J’ai déjà un compte', 'I already have an account')}
            </button>
          </div>
        </form>
      </Card>

      <Card title={t('Découvrir sans véhicule', 'Try without a vehicle')} subtitle={t('Mode démonstration : véhicule et scans simulés.', 'Demo mode: simulated vehicle and scans.')}>
        <button className="button" onClick={() => void demo()} disabled={busy}>
          {t('Entrer en mode démonstration', 'Enter demo mode')}
        </button>
        <div style={{ marginTop: 12 }}>
          <Notice tone="warn">
            {t(
              'En mode démonstration, toutes les mesures sont simulées et clairement étiquetées MODE SIMULATION. XAMOTO n’invente jamais une donnée : il dit quand il ne sait pas.',
              'In demo mode, all measurements are simulated and labelled SIMULATION MODE. XAMOTO never invents data: it says when it does not know.',
            )}
          </Notice>
        </div>
      </Card>
    </div>
  );
}
