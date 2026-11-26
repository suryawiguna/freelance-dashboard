import { lazy, Suspense } from "react";
import { AppShell } from "./components/AppShell";
import { DataProvider } from "./data/DataContext";
import { useAuth } from "./features/auth/AuthContext";
import { LoginPage } from "./features/auth/LoginPage";
import { NoAccessPage } from "./features/auth/NoAccessPage";
import { PanelHost } from "./features/panels/PanelHost";
import { usePage, type Page } from "./lib/route";

const TodayPage = lazy(() => import("./features/today/TodayPage"));
const ClientsPage = lazy(() => import("./features/clients/ClientsPage"));
const ClientDetailPage = lazy(() => import("./features/clients/ClientDetailPage"));
const MoneyPage = lazy(() => import("./features/money/MoneyPage"));
const ServicesPage = lazy(() => import("./features/services/ServicesPage"));
const GuidePage = lazy(() => import("./features/guide/GuidePage"));

function Content({ page }: { page: Page }) {
  switch (page.name) {
    case "clients":
      return <ClientsPage />;
    case "client":
      return <ClientDetailPage key={page.id} id={page.id} />;
    case "bills":
    case "assets":
      return <MoneyPage tab={page.name} />;
    case "services":
      return <ServicesPage />;
    case "guide":
      return <GuidePage />;
    default:
      return <TodayPage />;
  }
}

/**
 * Gerbang dan router saja. Tidak ada state bisnis di sini (PLAN §8): data
 * dimuat sekali di DataProvider; panel edit dirender PanelHost dari URL.
 */
export default function App() {
  const { loading, user, isOwner } = useAuth();
  const page = usePage();

  if (loading) return <div className="min-h-dvh" aria-busy="true" />;
  if (!user) return <LoginPage />;
  if (!isOwner) return <NoAccessPage />;

  return (
    <DataProvider>
      <AppShell page={page}>
        <Suspense fallback={null}>
          <Content page={page} />
        </Suspense>
      </AppShell>
      <PanelHost />
    </DataProvider>
  );
}
