import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-canvas text-center">
      <div>
        <div className="text-8xl font-black text-brand">404</div>
        <h1 className="text-2xl font-semibold text-ink mt-4">Page not found</h1>
        <p className="text-ink-dim text-sm mt-2">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-brand px-6 py-3 text-sm text-white font-medium transition-colors hover:bg-brand-hover"
          >
            Go Home
          </Link>
        </div>
      </div>
    </main>
  );
}
