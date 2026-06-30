import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex items-center justify-center px-4 bg-gray-50 text-center">
      <div>
        <div className="text-8xl font-black text-blue-600">404</div>
        <h1 className="text-2xl font-semibold text-gray-900 mt-4">Page not found</h1>
        <p className="text-gray-500 text-sm mt-2">
          The page you&apos;re looking for doesn&apos;t exist.
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-6 py-3 text-white font-medium transition-colors hover:bg-blue-700"
          >
            Go Home
          </Link>
        </div>
      </div>
    </main>
  );
}