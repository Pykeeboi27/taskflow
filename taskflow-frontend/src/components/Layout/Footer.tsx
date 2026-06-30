export default function Footer() {
  return (
    <footer className="py-6 text-center text-xs text-ink-muted border-t border-line">
      © {new Date().getFullYear()} TaskFlow
    </footer>
  );
}
