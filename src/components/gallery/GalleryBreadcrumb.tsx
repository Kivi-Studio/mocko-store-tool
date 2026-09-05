"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import type { Folder } from "@/lib/model/types";
import { versionLabel } from "@/lib/model/version";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Separator = () => <span className="opacity-50">/</span>;

const Crumb = ({ href, children }: { href: string; children: string }) => (
  <Link
    href={href}
    className="hover:text-foreground rounded px-1 py-0.5 transition-colors"
  >
    {children}
  </Link>
);

/**
 * The gallery's location line, up to three levels: all projects → app →
 * release. When the open folder belongs to an app, the last crumb is a version
 * picker, so hopping from 1.3.0 to 1.2.0 does not mean walking back to the root.
 */
export function GalleryBreadcrumb({
  app,
  folder,
  versions,
}: {
  /** The app being viewed, or the app the open folder belongs to. */
  app: string | null;
  /** The open folder, or `null` at the root and in an app's version list. */
  folder: Folder | null;
  /** The app's releases, newest first — empty when the folder has no app. */
  versions: Folder[];
}) {
  const appHref = app ? `/?app=${encodeURIComponent(app)}` : "/";

  return (
    <nav className="text-muted-foreground flex items-center gap-1.5 text-sm">
      {folder === null && app === null ? (
        <span className="text-foreground font-medium">All projects</span>
      ) : (
        <Crumb href="/">All projects</Crumb>
      )}

      {app !== null && (
        <>
          <Separator />
          {folder === null ? (
            <span className="text-foreground font-medium">{app}</span>
          ) : (
            <Crumb href={appHref}>{app}</Crumb>
          )}
        </>
      )}

      {folder !== null && (
        <>
          <Separator />
          {versions.length > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Switch version"
                className={cn(
                  buttonVariants({ variant: "ghost", size: "sm" }),
                  "text-foreground -ml-1 font-medium",
                )}
              >
                {versionLabel(folder)}
                <ChevronDown className="size-4 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {versions.map((v) => (
                  <DropdownMenuItem
                    key={v.id}
                    disabled={v.id === folder.id}
                    render={<Link href={`/?folder=${v.id}`} />}
                  >
                    {versionLabel(v)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <span className="text-foreground font-medium">
              {app === null ? folder.name : versionLabel(folder)}
            </span>
          )}
        </>
      )}
    </nav>
  );
}
