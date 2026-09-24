import Link from 'next/link';
import './globals.css';

// 404 hors de toute langue (ex. fichier statique manquant) : le layout racine ne rend pas <html>.
export default function RootNotFound() {
  return (
    <html lang="fr">
      <body className="min-h-screen flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-7xl font-black text-primary/80">404</div>
          <p className="mt-4 text-muted-foreground">Page introuvable · Page not found · الصفحة غير موجودة</p>
          <Link href="/" className="mt-6 inline-block text-primary hover:underline">
            Daourak
          </Link>
        </div>
      </body>
    </html>
  );
}
