import { Button } from "../../components/Button";
import { Centered } from "../../components/Centered";
import { useAuth } from "./AuthContext";

/** Akun Google lain. Rules juga menolaknya; layar ini hanya menjelaskan. */
export function NoAccessPage() {
  const { user, logout } = useAuth();
  return (
    <Centered>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Belum ada akses</h1>
        <p className="text-gray-600">Dashboard ini hanya untuk akun pemilik.</p>
      </div>
      <div className="space-y-1 rounded-card bg-gray-50 p-4">
        <p className="break-all">{user?.email || "Tanpa email"}</p>
        <p className="break-all text-gray-600">UID: {user?.uid}</p>
      </div>
      <Button className="w-full" onClick={() => void logout()}>
        Keluar
      </Button>
    </Centered>
  );
}
