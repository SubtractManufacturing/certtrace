import { Button } from "@certtrace/ui";
import { Copy } from "lucide-react";
import { useState } from "react";

interface ErrorBannerProps {
  message: string;
}

export function ErrorBanner({ message }: ErrorBannerProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(message);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      <p className="min-w-0 flex-1 whitespace-pre-wrap">{message}</p>
      <Button type="button" variant="outline" size="sm" onClick={() => void handleCopy()}>
        <Copy className="mr-1 h-3.5 w-3.5" />
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
