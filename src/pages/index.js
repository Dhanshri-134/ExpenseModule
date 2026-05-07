import AppNav from "@/components/AppNav";
import LandingHero from "@/components/LandingHero";
import MouseMotionContainer from "@/components/MouseMotionContainer";

export default function HomePage() {
  return (
    // <MouseMotionContainer>
      <div className="relative min-h-screen">
        <AppNav />
        <main className="w-full pb-16 pt-12 sm:pt-16">
          <LandingHero />
        </main>
      </div>
    // </MouseMotionContainer>
  );
}

