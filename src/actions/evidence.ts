'use server';

import { createHash, randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createServerClient, createAdminClient } from '@/services/supabase/server';

const MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
type MimePermitido = (typeof MIME_PERMITIDOS)[number];

const EXT_POR_MIME: Record<MimePermitido, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export interface EvidenceActionState {
  error?: string;
  success?: boolean;
  fileId?: string;
}

export interface EvidenceFileView {
  id: string;
  original_name: string;
  mime_type: string;
  file_size_bytes: number;
  sha256: string;
  uploaded_at: string;
  signedUrl: string | null;
}

/**
 * Sube un archivo de evidencia para una activity_entry.
 * Valida MIME y tamaño, calcula sha256 en servidor, guarda en Storage y registra en BD.
 */
export async function uploadEvidence(
  entryId: string,
  _prev: EvidenceActionState | null,
  formData: FormData,
): Promise<EvidenceActionState> {
  if (!entryId || !/^[0-9a-f-]{36}$/i.test(entryId)) {
    return { error: 'ID de entrada inválido' };
  }

  const file = formData.get('evidence') as File | null;
  if (!file || file.size === 0) return { error: 'Selecciona un archivo para adjuntar' };

  if (file.size > MAX_BYTES) {
    return { error: `El archivo supera el límite de 10 MB (${(file.size / 1_048_576).toFixed(1)} MB)` };
  }

  const mime = file.type as MimePermitido;
  if (!MIME_PERMITIDOS.includes(mime)) {
    return { error: 'Formato no permitido. Usa JPG, PNG, WebP o PDF.' };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  // Verificar que el usuario tiene acceso a la entry (org membership via join chain)
  const { data: entryCheck } = await supabase
    .from('activity_entries')
    .select(
      'id, reporting_period_id, reporting_periods(supplier_id, suppliers(organization_id))',
    )
    .eq('id', entryId)
    .maybeSingle();

  if (!entryCheck) return { error: 'Entrada no encontrada o sin acceso' };

  type PeriodoConSupplier = {
    supplier_id: string;
    suppliers: { organization_id: string } | null;
  };
  const periodo = entryCheck.reporting_periods as PeriodoConSupplier | null;
  const orgId = periodo?.suppliers?.organization_id;
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: memCheck } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!memCheck) return { error: 'Sin permisos para esta organización' };

  // Leer buffer, calcular sha256
  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = createHash('sha256').update(buffer).digest('hex');

  // Evitar duplicados por hash en la misma entry
  const { data: existing } = await supabase
    .from('evidence_files')
    .select('id')
    .eq('activity_entry_id', entryId)
    .eq('sha256', sha256)
    .maybeSingle();

  if (existing) return { error: 'Este archivo ya fue adjuntado a esta entrada' };

  const ext = EXT_POR_MIME[mime];
  const fileUuid = randomUUID();
  const storagePath = `evidence/${orgId}/${entryId}/${fileUuid}.${ext}`;

  // Subir con service_role para garantizar acceso al bucket privado
  const admin = createAdminClient();
  const { error: uploadError } = await admin.storage
    .from('evidence')
    .upload(storagePath, buffer, {
      contentType: mime,
      upsert: false,
    });

  if (uploadError) {
    return { error: 'Error al subir el archivo. Intenta nuevamente.' };
  }

  const originalName = file.name.slice(0, 255);

  // Registrar en BD
  const { data: inserted, error: insertError } = await supabase
    .from('evidence_files')
    .insert({
      activity_entry_id: entryId,
      storage_path: storagePath,
      mime_type: mime,
      file_size_bytes: file.size,
      original_name: originalName,
      sha256,
      uploaded_by: user.id,
    })
    .select('id')
    .single();

  if (insertError) {
    // Limpiar archivo huérfano si el insert falla
    await admin.storage.from('evidence').remove([storagePath]);
    return { error: 'Error al registrar el archivo de evidencia. Intenta nuevamente.' };
  }

  revalidatePath('/activity');
  revalidatePath('/audit');

  return { success: true, fileId: inserted.id };
}

/**
 * Lista los archivos de evidencia de una entry con URLs firmadas (1 hora de validez).
 */
export async function getEvidenceFiles(entryId: string): Promise<EvidenceFileView[]> {
  if (!entryId || !/^[0-9a-f-]{36}$/i.test(entryId)) return [];

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: rows } = await supabase
    .from('evidence_files')
    .select('id, original_name, mime_type, file_size_bytes, sha256, uploaded_at, storage_path')
    .eq('activity_entry_id', entryId)
    .order('uploaded_at', { ascending: true });

  if (!rows?.length) return [];

  const admin = createAdminClient();
  const results: EvidenceFileView[] = await Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await admin.storage
        .from('evidence')
        .createSignedUrl(row.storage_path, 3600);
      return {
        id: row.id,
        original_name: row.original_name,
        mime_type: row.mime_type,
        file_size_bytes: row.file_size_bytes,
        sha256: row.sha256,
        uploaded_at: row.uploaded_at,
        signedUrl: signed?.signedUrl ?? null,
      };
    }),
  );

  return results;
}

/**
 * Carga archivos de evidencia para múltiples entradas en una sola query.
 * Devuelve un mapa entry_id → archivos con URLs firmadas.
 */
const UUID_BATCH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getEvidenceFilesBatch(
  entryIds: string[],
): Promise<Map<string, EvidenceFileView[]>> {
  if (!entryIds.length) return new Map();

  // Rechazar cualquier ID con formato inválido para evitar consultas innecesarias
  const validIds = entryIds.filter((id) => UUID_BATCH_RE.test(id));
  if (!validIds.length) return new Map();

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Map();

  const { data: rows } = await supabase
    .from('evidence_files')
    .select('id, original_name, mime_type, file_size_bytes, sha256, uploaded_at, storage_path, activity_entry_id')
    .in('activity_entry_id', validIds)
    .order('uploaded_at', { ascending: true });

  if (!rows?.length) return new Map();

  const admin = createAdminClient();
  const result = new Map<string, EvidenceFileView[]>();

  await Promise.all(
    rows.map(async (row) => {
      const { data: signed } = await admin.storage
        .from('evidence')
        .createSignedUrl(row.storage_path, 3600);
      const view: EvidenceFileView = {
        id: row.id,
        original_name: row.original_name,
        mime_type: row.mime_type,
        file_size_bytes: row.file_size_bytes,
        sha256: row.sha256,
        uploaded_at: row.uploaded_at,
        signedUrl: signed?.signedUrl ?? null,
      };
      const list = result.get(row.activity_entry_id) ?? [];
      list.push(view);
      result.set(row.activity_entry_id, list);
    }),
  );

  return result;
}

export interface DeleteEvidenceState {
  error?: string;
  success?: boolean;
}

/**
 * Elimina un archivo de evidencia (BD + Storage). Solo el uploader o admin puede hacerlo.
 */
export async function deleteEvidence(
  fileId: string,
  _prev: DeleteEvidenceState | null,
  _formData: FormData,
): Promise<DeleteEvidenceState> {
  if (!fileId || !/^[0-9a-f-]{36}$/i.test(fileId)) {
    return { error: 'ID inválido' };
  }

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const { data: file } = await supabase
    .from('evidence_files')
    .select('id, storage_path, uploaded_by, activity_entry_id')
    .eq('id', fileId)
    .maybeSingle();

  if (!file) return { error: 'Archivo no encontrado' };

  // Solo el uploader o un admin de la org puede borrar
  if (file.uploaded_by !== user.id) {
    type EntryJoin = {
      reporting_periods: {
        suppliers: { organization_id: string } | null;
      } | null;
    };
    const { data: entryData } = await supabase
      .from('activity_entries')
      .select('reporting_periods(suppliers(organization_id))')
      .eq('id', file.activity_entry_id)
      .maybeSingle();

    const orgId = (entryData as EntryJoin | null)?.reporting_periods?.suppliers?.organization_id;
    if (!orgId) return { error: 'Sin permisos' };

    const { data: mem } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', user.id)
      .eq('organization_id', orgId)
      .maybeSingle();

    if (!mem || !['admin', 'consultant'].includes(mem.role)) {
      return { error: 'No tienes permisos para eliminar este archivo' };
    }
  }

  // Borrar de Storage
  const admin = createAdminClient();
  await admin.storage.from('evidence').remove([file.storage_path]);

  // Borrar registro BD
  await supabase.from('evidence_files').delete().eq('id', fileId);

  revalidatePath('/activity');
  revalidatePath('/audit');

  return { success: true };
}
