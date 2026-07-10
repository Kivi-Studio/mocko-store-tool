import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <h2 className="text-lg font-semibold">Page not found</h2>
      <p className="text-muted-foreground text-sm">
        This page doesn’t exist (anymore).
      </p>
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Back to projects
      </Link>
    </div>
  );
}
