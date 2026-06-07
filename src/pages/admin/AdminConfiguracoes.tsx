import { Navigate } from "react-router-dom";

/**
 * Legacy standalone settings page — superseded by the in-dashboard Settings tab
 * (AdminSettingsTab) which has full persistence wired up. Redirect to avoid
 * showing two competing UIs with different behavior.
 */
export default function AdminConfiguracoes() {
  return <Navigate to="/admin-matheus/dashboard?tab=settings" replace />;
}
