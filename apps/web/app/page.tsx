import { APP_NAME } from "@askwell/shared";
import { AuthControls } from "@/components/auth-controls";

export default function Home() {
  return (
    <>
      <header className="flex items-center justify-between p-4">
        <span className="font-semibold">{APP_NAME}</span>
        <nav className="flex items-center gap-3">
          <AuthControls />
        </nav>
      </header>
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-4xl font-semibold tracking-tight">{APP_NAME}</h1>
        <p className="max-w-md text-zinc-600">
          An AI support chat widget for any website.
        </p>
      </main>
    </>
  );
}
