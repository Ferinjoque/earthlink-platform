'use server';

import { createHash, randomUUID } from 'crypto';
import { revalidatePath } from 'next/cache';
import { createServerClient, createAdminClient } from '@/services/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MIME_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'] as const;
type MimePermitido = (typeof MIME_PERMITIDOS)[number];

const EXT_POR_MIME: Record<MimePermitido, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

// Valida los magic bytes del buffer contra el MIME declarado por el cliente
function validarMagicBytes(buffer: Buffer, mime: MimePermitido): boolean {
  if (mime === 'image/jpeg') return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mime === 'image/png') return buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47;
  if (mime === 'image/webp') return buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 && buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50;
  if (mime === 'application/pdf') return buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46;
  return false;
}

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
  if (!entryId || !UUID_RE.test(entryId)) {
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
      'id, voided_at, reporting_period_id, reporting_periods(status, supplier_id, suppliers(organization_id))',
    )
    .eq('id', entryId)
    .maybeSingle();

  if (!entryCheck) return { error: 'Entrada no encontrada o sin acceso' };
  if (entryCheck.voided_at) return { error: 'No se puede adjuntar evidencia a una entrada anulada' };

  type PeriodoConSupplier = {
    status: string;
    supplier_id: string;
    suppliers: { organization_id: string } | null;
  };
  const periodo = entryCheck.reporting_periods as PeriodoConSupplier | null;
  if (periodo?.status === 'locked') return { error: 'No se puede modificar un periodo bloqueado' };
  if (periodo?.status === 'calculating') return { error: 'No se puede adjuntar evidencia mientras el periodo está siendo calculado' };
  const orgId = periodo?.suppliers?.organization_id;
  if (!orgId) return { error: 'No se pudo determinar la organización' };

  const { data: memCheck } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!memCheck) return { error: 'Sin permisos para esta organización' };

  // Leer buffer, validar magic bytes y calcular sha256
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length < 12 || !validarMagicBytes(buffer, mime)) {
    return { error: 'El contenido del archivo no coincide con el formato declarado.' };
  }
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

  // Eliminar control ASCII y Unicode bidi/invisibles que podrían disfrazar el nombre del archivo
  const originalName = file.name
    .replace(/[\x00-\x1f\x7f​-‏‪-‮⁦-⁩﻿]/g, '')
    .slice(0, 255);

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
  revalidatePath('/suppliers');

  return { success: true, fileId: inserted.id };
}

/**
 * Lista los archivos de evidencia de una entry con URLs firmadas (1 hora de validez).
 */
export async function getEvidenceFiles(entryId: string): Promise<EvidenceFileView[]> {
  if (!entryId || !UUID_RE.test(entryId)) return [];

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  // Verificar que el usuario tiene acceso a la entry (aislamiento de tenant)
  const { data: entryCheck } = await supabase
    .from('activity_entries')
    .select('id, reporting_periods(supplier_id, suppliers(organization_id))')
    .eq('id', entryId)
    .maybeSingle();

  if (!entryCheck) return [];

  type PeriodoConSupplierLectura = {
    supplier_id: string;
    suppliers: { organization_id: string } | null;
  };
  const periodoLectura = entryCheck.reporting_periods as PeriodoConSupplierLectura | null;
  const orgIdLectura = periodoLectura?.suppliers?.organization_id;
  if (!orgIdLectura) return [];

  const { data: memCheckLectura } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgIdLectura)
    .maybeSingle();

  if (!memCheckLectura) return [];

  const { data: rows } = await supabase
    .from('evidence_files')
    .select('id, original_name, mime_type, file_size_bytes, sha256, uploaded_at, storage_path')
    .eq('activity_entry_id', entryId)
    .order('uploaded_at', { ascending: true });

  if (!rows?.length) return [];

  const admin = createAdminClient();
  const paths = rows.map((r) => r.storage_path);
  const { data: signedList } = await admin.storage.from('evidence').createSignedUrls(paths, 3600);
  const signedMap = new Map((signedList ?? []).map((s) => [s.path, s.signedUrl]));

  return rows.map((row) => ({
    id: row.id,
    original_name: row.original_name,
    mime_type: row.mime_type,
    file_size_bytes: row.file_size_bytes,
    sha256: row.sha256,
    uploaded_at: row.uploaded_at,
    signedUrl: signedMap.get(row.storage_path) ?? null,
  }));
}

/**
 * Carga archivos de evidencia para múltiples entradas en una sola query.
 * Devuelve un mapa entry_id → archivos con URLs firmadas.
 */
const UUID_BATCH_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_BATCH_EVIDENCIA = 200;
const MAX_STORAGE_PATHS = 500;

export async function getEvidenceFilesBatch(
  entryIds: string[],
): Promise<Map<string, EvidenceFileView[]>> {
  if (!entryIds.length) return new Map();

  // Rechazar cualquier ID con formato inválido para evitar consultas innecesarias
  const validIds = entryIds.filter((id) => UUID_BATCH_RE.test(id));
  if (!validIds.length) return new Map();

  // Limitar tamaño del lote para prevenir DoS por consultas masivas
  if (validIds.length > MAX_BATCH_EVIDENCIA) return new Map();

  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new Map();

  // Verificar aislamiento de tenant: solo entries de orgs del usuario
  const { data: membershipData } = await supabase
    .from('memberships')
    .select('organization_id')
    .eq('user_id', user.id);
  const userOrgIds = new Set(
    (membershipData ?? []).map((m) => m.organization_id).filter((id): id is string => id !== null),
  );
  if (userOrgIds.size === 0) return new Map();

  type EntryOrg = {
    id: string;
    reporting_periods: { suppliers: { organization_id: string } | null } | null;
  };
  const { data: entryChecks } = await supabase
    .from('activity_entries')
    .select('id, reporting_periods(suppliers(organization_id))')
    .in('id', validIds);

  const authorizedEntryIds = ((entryChecks ?? []) as EntryOrg[])
    .filter((e) => {
      const orgId = e.reporting_periods?.suppliers?.organization_id;
      return orgId ? userOrgIds.has(orgId) : false;
    })
    .map((e) => e.id);

  if (authorizedEntryIds.length === 0) return new Map();

  const { data: rows } = await supabase
    .from('evidence_files')
    .select('id, original_name, mime_type, file_size_bytes, sha256, uploaded_at, storage_path, activity_entry_id')
    .in('activity_entry_id', authorizedEntryIds)
    .order('uploaded_at', { ascending: true });

  if (!rows?.length) return new Map();

  const admin = createAdminClient();
  // Limitar rutas al máximo permitido para prevenir DoS en la API de Storage
  const limitedRows = rows.slice(0, MAX_STORAGE_PATHS);
  const paths = limitedRows.map((r) => r.storage_path);
  const { data: signedList } = await admin.storage.from('evidence').createSignedUrls(paths, 3600);
  const signedMap = new Map((signedList ?? []).map((s) => [s.path, s.signedUrl]));

  const result = new Map<string, EvidenceFileView[]>();
  for (const row of limitedRows) {
    const view: EvidenceFileView = {
      id: row.id,
      original_name: row.original_name,
      mime_type: row.mime_type,
      file_size_bytes: row.file_size_bytes,
      sha256: row.sha256,
      uploaded_at: row.uploaded_at,
      signedUrl: signedMap.get(row.storage_path) ?? null,
    };
    const list = result.get(row.activity_entry_id) ?? [];
    list.push(view);
    result.set(row.activity_entry_id, list);
  }

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
  if (!fileId || !UUID_RE.test(fileId)) {
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

  // Verificar siempre que el usuario pertenece a la org — incluso si es el uploader,
  // porque su membresía puede haber sido revocada o degradada desde que subió el archivo.
  type EntryJoin = {
    reporting_periods: {
      status: string;
      suppliers: { organization_id: string } | null;
    } | null;
  };
  const { data: entryData } = await supabase
    .from('activity_entries')
    .select('reporting_periods(status, suppliers(organization_id))')
    .eq('id', file.activity_entry_id)
    .maybeSingle();

  const typedEntry = entryData as EntryJoin | null;
  if (typedEntry?.reporting_periods?.status === 'locked') {
    return { error: 'No se puede modificar un periodo bloqueado' };
  }
  if (typedEntry?.reporting_periods?.status === 'calculating') {
    return { error: 'No se puede eliminar evidencia mientras el periodo está siendo calculado' };
  }
  const orgId = typedEntry?.reporting_periods?.suppliers?.organization_id;
  if (!orgId) return { error: 'Sin permisos' };

  const { data: mem } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!mem) return { error: 'Sin permisos' };

  // El uploader puede borrar sus propios archivos; solo admin puede borrar cualquier archivo
  if (file.uploaded_by !== user.id && mem.role !== 'admin') {
    return { error: 'No tienes permisos para eliminar este archivo' };
  }

  // Borrar registro BD primero: si falla, el archivo en Storage sigue intacto (recuperable)
  const { error: dbError } = await supabase.from('evidence_files').delete().eq('id', fileId);
  if (dbError) return { error: 'Error al eliminar el registro. Intenta nuevamente.' };

  // Borrar de Storage — si falla, el registro ya fue eliminado (archivo huérfano recuperable)
  const admin = createAdminClient();
  await admin.storage.from('evidence').remove([file.storage_path]);

  revalidatePath('/activity');
  revalidatePath('/audit');
  revalidatePath('/suppliers');

  return { success: true };
}
