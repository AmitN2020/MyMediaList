import { AuthForm } from "./auth-form";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gradient-to-b from-background via-muted/20 to-background">
      <div className="w-full max-w-md rounded-2xl border border-border/60 bg-card p-8 shadow-xl backdrop-blur">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-xl shadow-md">
            M
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Welcome to MyMediaList</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Track movies, TV shows, and books with intelligent, personalized recommendations.
          </p>
        </div>

        <AuthForm />

        <p className="mt-8 text-center text-xs text-muted-foreground">
          By signing in, you agree to our Terms of Service and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
