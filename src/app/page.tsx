import { Suspense } from "react";
import { ProjectGallery } from "@/components/gallery/ProjectGallery";

export default function HomePage() {
  // ProjectGallery reads the `?folder=` param via useSearchParams, which needs
  // a Suspense boundary under static export.
  return (
    <Suspense>
      <ProjectGallery />
    </Suspense>
  );
}
