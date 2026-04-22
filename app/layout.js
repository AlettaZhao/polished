export const metadata = {
  title: "推敲",
  description: "逐句拆解，把模糊的话想清楚",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
