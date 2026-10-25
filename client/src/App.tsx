import { Link, Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import { AppLayout } from "./components/AppLayout";
import { ProjectLayout } from "./components/ProjectLayout";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { ProjectsPage } from "./pages/ProjectsPage";
import { GanttPage } from "./pages/GanttPage";
import { TeamPage } from "./pages/TeamPage";
import { CalendarPage } from "./pages/CalendarPage";
import { AnalysisPage } from "./pages/AnalysisPage";
import { Spinner } from "./components/ui/Misc";

function RequireAuth() {
  const { status } = useAuth();
  if (status === "loading") {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas">
        <Spinner label="Memeriksa sesi…" />
      </div>
    );
  }
  if (status === "anonymous") {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}

function NotFoundPage() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-6">
      <div className="max-w-md text-center">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-700">404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Halaman tidak ditemukan</h1>
        <p className="mt-2 text-sm text-ink-2">
          Tautan mungkin salah atau halaman sudah dipindahkan. Kembali ke daftar proyek untuk
          melanjutkan.
        </p>
        <Link
          to="/projects"
          className="mt-5 inline-flex h-10 items-center rounded-sm bg-brand-600 px-4 text-sm font-medium text-white shadow-sm hover:bg-brand-700"
        >
          Ke daftar proyek
        </Link>
      </div>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/projects/:id" element={<ProjectLayout />}>
            <Route index element={<Navigate to="gantt" replace />} />
            <Route path="gantt" element={<GanttPage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="analysis" element={<AnalysisPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>

      <Route path="/" element={<Navigate to="/projects" replace />} />
    </Routes>
  );
}
