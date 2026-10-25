"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en-IN">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fffbef", color: "#111", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0, textAlign: "center", padding: 16 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800 }}>Cool Kick is taking a quick break</h1>
          <p style={{ color: "#555" }}>Something went wrong. Please try again in a moment.</p>
          <button onClick={reset} style={{ marginTop: 16, background: "#6ba32e", color: "#fff", border: 0, borderRadius: 999, padding: "12px 24px", fontWeight: 700, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
