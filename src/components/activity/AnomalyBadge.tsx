import { Badge } from '@/components/ui/Badge';
import type { AnomalySeverity } from '@/types/database';

interface AnomalyBadgeProps {
  severity: AnomalySeverity;
  zScore?: number | undefined;
}

const ETIQUETAS: Record<AnomalySeverity, string> = {
  low: 'Anomalía: baja',
  medium: 'Anomalía: media',
  high: 'Anomalía: ALTA',
};

export function AnomalyBadge({ severity, zScore }: AnomalyBadgeProps) {
  const label =
    zScore !== undefined ? `${ETIQUETAS[severity]} (${zScore.toFixed(1)}σ)` : ETIQUETAS[severity];
  return <Badge variant={severity}>{label}</Badge>;
}
