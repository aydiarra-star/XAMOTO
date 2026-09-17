import { NavLink, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './auth';
import { useVehicles } from './vehicle-context';
import { useI18n } from './i18n';
import { Spinner } from './components';
import LoginScreen from './screens/Login';
import HomeScreen from './screens/Home';
import VehiclesScreen from './screens/Vehicles';
import VehicleDetailScreen from './screens/VehicleDetail';
import ScanScreen from './screens/Scan';
import DiagnosticScreen from './screens/Diagnostic';
import CanIDriveScreen from './screens/CanIDrive';
import GuidedTestsScreen from './screens/GuidedTests';
import AssistantScreen from './screens/Assistant';
import PostRepairScreen from './screens/PostRepair';
import SecondOpinionScreen from './screens/SecondOpinion';
import MaintenanceScreen from './screens/Maintenance';
import InspectionScreen from './screens/Inspection';
import ReportScreen from './screens/Report';
import GaragesScreen from './screens/Garages';
import AlertsScreen from './screens/Alerts';

export default function App(): JSX.Element {
  const { user, loading, logout } = useAuth();
  const { vehicles, vehicle, select } = useVehicles();
  const { locale, setLocale, t } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="content" style={{ paddingTop: 80 }}>
        <Spinner label="Ouverture de XAMOTO…" />
      </div>
    );
  }

  if (!user) {
    return (
      <Routes>
        <Route path="/login" element={<LoginScreen />} />
        <Route path="*" element={<Navigate to="/login" replace state={{ from: location.pathname }} />} />
      </Routes>
    );
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">X</span>
          <span>
            XAMOTO
            <small>{t('Connaître sa voiture.', 'Know your car.')}</small>
          </span>
        </div>

        <nav className="nav">
          <NavLink to="/" end>🏠 {t('Accueil', 'Home')}</NavLink>
          <NavLink to="/vehicles">🚗 {t('Mes véhicules', 'My vehicles')}</NavLink>
          <NavLink to="/scan">🔌 {t('Connecter / scanner', 'Connect / scan')}</NavLink>
          <NavLink to="/assistant">💬 {t('Assistant', 'Assistant')}</NavLink>

          <div className="nav-group">{t('Diagnostic', 'Diagnosis')}</div>
          <NavLink to="/post-repair">🔁 {t('Après réparation', 'After repair')}</NavLink>
          <NavLink to="/second-opinion">⚖️ {t('Second avis', 'Second opinion')}</NavLink>
          <NavLink to="/inspection">🔍 {t('Avant achat', 'Pre-purchase')}</NavLink>

          <div className="nav-group">{t('Suivi', 'Tracking')}</div>
          <NavLink to="/maintenance">🗓️ {t('Entretien', 'Maintenance')}</NavLink>
          <NavLink to="/alerts">🔔 {t('Alertes', 'Alerts')}</NavLink>
          <NavLink to="/garages">🧰 {t('Garages', 'Garages')}</NavLink>
        </nav>

        <div className="spacer" />
        <div className="small muted">
          {user.fullName}
          <br />
          {user.plan === 'premium' ? t('Compte premium', 'Premium account') : t('Compte gratuit', 'Free account')}
        </div>
        <div className="row">
          <button className="button small ghost" onClick={() => setLocale(locale === 'fr' ? 'en' : 'fr')}>
            {locale === 'fr' ? 'English' : 'Français'}
          </button>
          <button className="button small ghost" onClick={() => void logout().then(() => navigate('/login'))}>
            {t('Quitter', 'Sign out')}
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <div>
            <h1>{t('XAMOTO — Connaître sa voiture', 'XAMOTO — Know your car')}</h1>
            <div className="sub">{t('Comprendre · Diagnostiquer · Agir', 'Understand · Diagnose · Act')}</div>
          </div>
          {vehicles.length > 0 && (
            <label className="row small" style={{ margin: 0 }}>
              <span className="muted">{t('Véhicule', 'Vehicle')}</span>
              <select
                value={vehicle?.id ?? ''}
                onChange={(event) => select(event.target.value)}
                style={{ width: 'auto', minWidth: 210 }}
              >
                {vehicles.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.nickname ? `${item.nickname} — ` : ''}
                    {item.brand} {item.model} ({item.year})
                  </option>
                ))}
              </select>
            </label>
          )}
        </header>

        <main className="content">
          <Routes>
            <Route path="/" element={<HomeScreen />} />
            <Route path="/vehicles" element={<VehiclesScreen />} />
            <Route path="/vehicles/:id" element={<VehicleDetailScreen />} />
            <Route path="/scan" element={<ScanScreen />} />
            <Route path="/diagnostics/:id" element={<DiagnosticScreen />} />
            <Route path="/diagnostics/:id/rouler" element={<CanIDriveScreen />} />
            <Route path="/diagnostics/:id/tests" element={<GuidedTestsScreen />} />
            <Route path="/assistant" element={<AssistantScreen />} />
            <Route path="/post-repair" element={<PostRepairScreen />} />
            <Route path="/second-opinion" element={<SecondOpinionScreen />} />
            <Route path="/maintenance" element={<MaintenanceScreen />} />
            <Route path="/inspection" element={<InspectionScreen />} />
            <Route path="/reports/:id" element={<ReportScreen />} />
            <Route path="/garages" element={<GaragesScreen />} />
            <Route path="/alerts" element={<AlertsScreen />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}
