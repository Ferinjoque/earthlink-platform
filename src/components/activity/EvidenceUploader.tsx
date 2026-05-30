'use client';

import { useRef, useActionState, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Paperclip, X, FileText, Image as ImageIcon } from 'lucide-react';
import { uploadEvidence, deleteEvidence } from '@/actions/evidence';
import type {
  EvidenceActionState,
  EvidenceFileView,
  DeleteEvidenceState,
} from '@/actions/evidence';
import { useToast } from '@/components/ui/Toast';

interface EvidenceUploaderProps {
  entryId: string;
  files: EvidenceFileView[];
  onSuccess?: () => void;
  readOnly?: boolean;
  /**
   * Modo batch: cuando se provee esta función, el componente solo gestiona
   * la selección y preview del archivo. La subida la controla el padre.
   * Llama con null para indicar cancelación/limpieza.
   */
  onPendingFileChange?: (file: File | null) => void;
}

function iconoPorMime(mime: string) {
  if (mime.startsWith('image/')) return <ImageIcon size={14} aria-hidden="true" />;
  return <FileText size={14} aria-hidden="true" />;
}

function iconoPorNombre(name: string) {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png' || ext === 'webp')
    return <ImageIcon size={14} aria-hidden="true" />;
  return <FileText size={14} aria-hidden="true" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function EvidenceDeleteButton({ fileId }: { fileId: string }) {
  const [state, action, isPending] = useActionState<DeleteEvidenceState | null, FormData>(
    deleteEvidence.bind(null, fileId),
    null,
  );
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    if (state?.error) toast(state.error, 'error');
    else if (state?.success) {
      toast('Evidencia eliminada', 'success');
      router.refresh();
    }
  }, [state, toast, router]);

  return (
    <form action={action}>
      <button
        type="submit"
        disabled={isPending}
        title="Eliminar evidencia"
        style={{
          background: 'none',
          border: 'none',
          cursor: isPending ? 'not-allowed' : 'pointer',
          color: 'var(--color-ink-3)',
          padding: '0 var(--space-1)',
          display: 'inline-flex',
          alignItems: 'center',
          opacity: isPending ? 0.5 : 1,
        }}
      >
        <X size={12} aria-hidden="true" />
      </button>
    </form>
  );
}

export function EvidenceUploader({
  entryId,
  files,
  onSuccess,
  readOnly = false,
  onPendingFileChange,
}: EvidenceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const router = useRouter();
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [, startTransition] = useTransition();

  // Modo standalone: sube directamente con useActionState
  const uploadWithId = uploadEvidence.bind(null, entryId);
  const [state, action, isActionPending] = useActionState<EvidenceActionState | null, FormData>(
    uploadWithId,
    null,
  );

  useEffect(() => {
    if (state?.error) {
      toast(state.error, 'error');
    } else if (state?.success) {
      toast('Evidencia adjuntada', 'success');
      setPendingFile(null);
      onSuccess?.();
      router.refresh();
    }
  }, [state, toast, onSuccess, router]);

  function handleFileChange() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    setPendingFile(file);
    // En modo batch: notificar al padre, no subir aquí
    onPendingFileChange?.(file);
  }

  function handleStandaloneUpload() {
    if (!pendingFile) return;
    const fd = new FormData();
    fd.append('evidence', pendingFile);
    startTransition(() => {
      action(fd);
    });
  }

  function handleCancel() {
    setPendingFile(null);
    if (inputRef.current) inputRef.current.value = '';
    onPendingFileChange?.(null);
  }

  const isBatchMode = typeof onPendingFileChange !== 'undefined';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      {/* Lista de archivos ya subidos */}
      {files.length > 0 && (
        <ul
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-1)',
          }}
        >
          {files.map((f) => (
            <li
              key={f.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-1)',
                fontSize: 'var(--text-xs)',
                color: 'var(--color-ink-2)',
              }}
            >
              <span style={{ color: 'var(--color-accent)', flexShrink: 0 }}>
                {iconoPorMime(f.mime_type)}
              </span>
              {f.signedUrl ? (
                <a
                  href={f.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={`SHA-256: ${f.sha256}`}
                  style={{
                    color: 'var(--color-ink-2)',
                    textDecoration: 'underline',
                    textDecorationColor: 'var(--color-border)',
                    maxWidth: '160px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.original_name}
                </a>
              ) : (
                <span
                  style={{
                    maxWidth: '160px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {f.original_name}
                </span>
              )}
              <span style={{ color: 'var(--color-ink-3)', flexShrink: 0 }}>
                {formatBytes(f.file_size_bytes)}
              </span>
              {!readOnly && <EvidenceDeleteButton fileId={f.id} />}
            </li>
          ))}
        </ul>
      )}

      {/* Input de archivo oculto */}
      {!readOnly && (
        <input
          ref={inputRef}
          type="file"
          name="evidence"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          disabled={isActionPending}
        />
      )}

      {/* Vista: preview del archivo seleccionado o botón para seleccionar */}
      {!readOnly &&
        (pendingFile ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--color-surface-2)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--color-border)',
            }}
          >
            <span style={{ color: 'var(--color-accent)', flexShrink: 0 }}>
              {iconoPorNombre(pendingFile.name)}
            </span>
            <span
              style={{
                flex: 1,
                fontSize: 'var(--text-xs)',
                color: 'var(--color-ink-1)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {pendingFile.name}
            </span>
            <span
              style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-3)', flexShrink: 0 }}
            >
              {formatBytes(pendingFile.size)}
            </span>
            {/* En modo standalone: botón Subir explícito */}
            {!isBatchMode && (
              <button
                type="button"
                onClick={handleStandaloneUpload}
                disabled={isActionPending}
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  color: 'var(--color-surface-0)',
                  background: isActionPending ? 'var(--color-ink-3)' : 'var(--color-accent)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding: 'var(--space-1) var(--space-2)',
                  cursor: isActionPending ? 'not-allowed' : 'pointer',
                  fontFamily: 'var(--font-sans)',
                  flexShrink: 0,
                }}
              >
                {isActionPending ? 'Subiendo…' : 'Subir'}
              </button>
            )}
            {!isActionPending && (
              <button
                type="button"
                onClick={handleCancel}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--color-ink-3)',
                  padding: '0 var(--space-1)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  flexShrink: 0,
                }}
                title="Quitar archivo"
              >
                <X size={12} aria-hidden="true" />
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isActionPending}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 'var(--space-1)',
              fontSize: 'var(--text-xs)',
              color: 'var(--color-accent)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 0,
              fontFamily: 'var(--font-sans)',
            }}
          >
            <Paperclip size={12} aria-hidden="true" />
            Adjuntar evidencia
          </button>
        ))}
    </div>
  );
}
