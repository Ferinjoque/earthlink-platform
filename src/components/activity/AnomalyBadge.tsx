import { Badge } from '@/components/ui/Badge';
import type { AnomalySeverity } from '@/types/database';

interface AnomalyBadgeProps {
  severity: AnomalySeverity;
  zScore?: number | undefined;
}

const LABELS: Record<AnomalySeverity, string> = {
  low: 'Anomaly: low',
  medium: 'Anomaly: medium',
  high: 'Anomaly: HIGH',
};

export function AnomalyBadge({ severity, zScore }: AnomalyBadgeProps) {
  const label =
    zScore !== undefined ? `${LABELS[severity]} (${zScore.toFixed(1)}σ)` : LABELS[severity];
  return <Badge variant={severity}>{label}</Badge>;
}
