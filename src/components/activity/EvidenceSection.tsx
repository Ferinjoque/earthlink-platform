import { getEvidenceFiles } from '@/actions/evidence';
import { EvidenceUploader } from './EvidenceUploader';

interface EvidenceSectionProps {
  entryId: string;
}

/**
 * Server Component: carga archivos de evidencia y renderiza el uploader cliente.
 * Usar dentro de páginas con Suspense si la carga puede ser lenta.
 */
export async function EvidenceSection({ entryId }: EvidenceSectionProps) {
  const files = await getEvidenceFiles(entryId);
  return <EvidenceUploader entryId={entryId} files={files} />;
}
