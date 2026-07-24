interface AppLogoProps {
  /** Sidebar header: full width. Welcome card: centered, slightly smaller. */
  variant?: "sidebar" | "welcome";
}

export function AppLogo({ variant = "sidebar" }: AppLogoProps) {
  const className =
    variant === "sidebar" ? "block w-full h-auto" : "mx-auto block h-10 w-auto max-w-full";

  return <img src="/logo-horizontal.svg" alt="CertTrace" className={className} />;
}
