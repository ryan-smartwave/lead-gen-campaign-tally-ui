import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "@/components/nav/AppNav";

export const metadata: Metadata = {
  title: "Campaign Tally",
  description: "Daily hashtag tallies for the campaign, across Instagram and Facebook",
};

// Applies the saved theme before first paint so the page never flashes the wrong one.
const THEME_SCRIPT = `try{var t=localStorage.getItem("theme");if(t==="dark"||t==="light"){document.documentElement.dataset.theme=t}}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning is required, not a papered-over bug: the script
    // below deliberately sets data-theme on this element before React hydrates,
    // so the client always has an attribute the server did not render. Without
    // it React reports a mismatch on every load. Scoped to <html> only.
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <AppNav />
        <main className="shell">{children}</main>
      </body>
    </html>
  );
}
