-- Migración 020: campo data_quality en activity_entries
-- El Protocolo GHG requiere distinguir valores medidos vs estimados vs calculados.
-- Este campo habilita reportes de calidad (% medido vs estimado) y afecta
-- la confianza de detección de anomalías.

ALTER TABLE activity_entries
  ADD COLUMN IF NOT EXISTS data_quality text
    DEFAULT 'measured'
    CHECK (data_quality IN ('measured', 'estimated', 'calculated'));

COMMENT ON COLUMN activity_entries.data_quality IS
  'Cómo se obtuvo raw_quantity: measured (medidor directo/factura), estimated (proxy/interpolación), calculated (derivado de otros datos)';

-- Backfill: las entradas existentes se asumen como medidas
UPDATE activity_entries SET data_quality = 'measured' WHERE data_quality IS NULL;

-- Hacer NOT NULL después del backfill
ALTER TABLE activity_entries ALTER COLUMN data_quality SET NOT NULL;
ALTER TABLE activity_entries ALTER COLUMN data_quality SET DEFAULT 'measured';
