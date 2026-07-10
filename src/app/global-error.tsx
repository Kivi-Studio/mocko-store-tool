"use client";

/**
 * Last-resort boundary for errors in the root layout itself. It replaces the
 * layout entirely, so it must render its own <html>/<body> and cannot rely
 * on global styles.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  console.error(error);
  return (
    <html lang="en">
      <body
        style={{
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <h2>Something went wrong</h2>
        <p>Your projects are stored locally and are safe.</p>
        <button
          onClick={() => unstable_retry()}
          style={{ padding: "0.5rem 1rem", cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
