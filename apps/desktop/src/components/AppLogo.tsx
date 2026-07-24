interface AppLogoProps {
  /** Sidebar header: full width. Welcome card: centered. */
  variant?: "sidebar" | "welcome";
}

export function AppLogo({ variant = "sidebar" }: AppLogoProps) {
  const className =
    variant === "sidebar"
      ? "block h-auto w-full"
      : "mx-auto block h-14 w-auto max-w-full sm:h-16";

  return <img src="/logo-horizontal.svg" alt="CertTrace" className={className} />;
}
