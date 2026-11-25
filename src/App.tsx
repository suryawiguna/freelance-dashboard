import { lazy, Suspense } from "react";
import { AppShell } from "./components/AppShell";
import { DataProvider } from "./data/DataContext";
import { useAuth } from "./features/auth/AuthContext";
import { LoginPage } from "./features/auth/LoginPage";
import { NoAccessPage } from "./features/auth/NoAccessPage";
import { useRoute, type RoutePath } from "./lib/route";

const PAGES: Record<RoutePath, ReturnType<typeof lazy>> = {
  "/": lazy(() => import("./features/summary/SummaryPage")),
  "/lead": lazy(() => import("./features/leads/LeadsPage")),
  "/proyek": lazy(() => import("./features/projects/ProjectsPage")),
  "/tagihan": lazy(() => import("./features/payments/PaymentsPage")),
  "/aset": lazy(() => import("./features/assets/AssetsPage")),
};

/**
 * Gerbang dan router saja. Tidak ada state bisnis di sini (PLAN §8):
 * data tiap koleksi dimuat di halamannya lewat data/repo.ts.
 */
export default function App() {
  const { loading, user, isOwner } = useAuth();
  const route = useRoute();

  if (loading) return <div className="min-h-dvh" aria-busy="true" />;
  if (!user) return <LoginPage />;
  if (!isOwner) return <NoAccessPage />;

  const Page = PAGES[route];
  return (
    <DataProvider>
      <AppShell route={route}>
        <Suspense fallback={null}>
          <Page />
        </Suspense>
      </AppShell>
    </DataProvider>
  );
}
