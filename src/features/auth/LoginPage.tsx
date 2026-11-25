import { Button } from "../../components/Button";
import { Centered } from "../../components/Centered";
import { useAuth } from "./AuthContext";

export function LoginPage() {
  const { signInWithGoogle, signInAsOwnerEmulator, error } = useAuth();
  return (
    <Centered>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Dashboard freelance</h1>
        <p className="text-gray-600">Masuk dengan akun Google pemilik.</p>
      </div>
      <div className="space-y-3">
        <Button variant="primary" className="w-full" onClick={() => void signInWithGoogle()}>
          Masuk dengan Google
        </Button>
        {signInAsOwnerEmulator && (
          <Button className="w-full" onClick={() => void signInAsOwnerEmulator()}>
            Masuk sebagai pemilik (emulator)
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-late">
          {error}
        </p>
      )}
    </Centered>
  );
}
