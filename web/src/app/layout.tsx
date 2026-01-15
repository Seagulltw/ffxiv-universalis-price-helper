import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Universalis 查價 | 製作收益試算',
  description: 'FFXIV 製作收益試算與市場價格查詢工具'
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body>
        <div className="min-h-screen px-6 py-10">
          {children}
        </div>
      </body>
    </html>
  );
}
