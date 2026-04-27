import "@/styles/globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <main>
        <Component {...pageProps} />
      </main>
    </ThemeProvider>
  );
}
