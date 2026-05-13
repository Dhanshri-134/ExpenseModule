import "@/styles/globals.css";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { AppQueryProvider } from "@/shared/query/provider";

export default function App({ Component, pageProps }) {
  return (
    <AppQueryProvider>
      <ThemeProvider>
        <main>
          <Component {...pageProps} />
        </main>
      </ThemeProvider>
    </AppQueryProvider>
  );
}
