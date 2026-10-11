export const metadata = {
  title: "Statement Parser",
  description: "Upload SBI / PhonePe / GPay statements and download results",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#0f172a", color: "#e2e8f0" }}>
        {children}
      </body>
    </html>
  );
}
