import { ExternalLink } from "lucide-react";
import { SHOW_FACE_SEARCH } from "@/config/features";
import { FaceSearchSection } from "@/components/FaceSearchSection";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { pt } from "../i18n";
import { ScreenHeader } from "../components/ui";

const DRIVE_URL = "https://drive.google.com/drive/folders/1fgjMr5gKO2aDpTvbeYVio_HtbF-IX4tI";

/**
 * Fotos (mockup 3): búsqueda por selfie ya existente en 3BUK (reconocimiento facial).
 * Todo gratis por ahora: se usa la descarga gratuita actual, sin compra.
 */
export default function Fotos() {
  return (
    <div>
      <ScreenHeader title={pt.fotos.titulo} />
      <p className="px-6 pt-3 text-[16px] text-[var(--buky-muted)]">{pt.fotos.sub}</p>
      <div className="buky-photos mt-4 px-4">
        {SHOW_FACE_SEARCH ? (
          <ErrorBoundary>
            <FaceSearchSection />
          </ErrorBoundary>
        ) : (
          <a href={DRIVE_URL} target="_blank" rel="noreferrer" className="buky-btn mt-6">
            Ver fotos <ExternalLink size={18} />
          </a>
        )}
      </div>
    </div>
  );
}
