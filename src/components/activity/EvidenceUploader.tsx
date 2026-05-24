'use client';

import { useRef, useActionState, useEffect } from 'react';
import { Paperclip, X, FileText, Image } from 'lucide-react';
import { uploadEvidence, deleteEvidence } from '@/actions/evidence';
import type { EvidenceActionState, EvidenceFileView, DeleteEvidenceState } from '@/actions/evidence';
import { useToast } from '@/components/ui/Toast';

interface EvidenceUploaderProps {
  entryId: string;
  files: EvidenceFileView[];
  onSuccess?: () => void;
}

function iconoPorMime(mime: string) {
  if (mime.startsWith('image/')) return <Image size={14} aria-hidden="true" />;
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

  useEffect(() => {
    if (state?.error) toast(state.error, 'error');
  }, [state, toast]);

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

export function EvidenceUploader({ entryId, files, onSuccess }: EvidenceUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  const uploadWithId = uploadEvidence.bind(null, entryId);
  const [state, action, isPending] = useActionState<EvidenceActionState | null, FormData>(
    uploadWithId,
    null,
  );

  useEffect(() => {
    if (state?.error) {
      toast(state.error, 'error');
    } else if (state?.success) {
      toast('Evidencia adjuntada', 'success');
      formRef.current?.reset();
      onSuccess?.();
    }
  }, [state, toast, onSuccess]);

  function handleFileChange() {
    const file = inputRef.current?.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('evidence', file);
    action(fd);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-1)' }}>
      {/* Lista de archivos adjuntos */}
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
              <EvidenceDeleteButton fileId={f.id} />
            </li>
          ))}
        </ul>
      )}

      {/* Botón para adjuntar nuevo archivo */}
      <form ref={formRef}>
        <input
          ref={inputRef}
          type="file"
          name="evidence"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          style={{ display: 'none' }}
          onChange={handleFileChange}
          disabled={isPending}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isPending}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            fontSize: 'var(--text-xs)',
            color: isPending ? 'var(--color-ink-3)' : 'var(--color-accent)',
            background: 'none',
            border: 'none',
            cursor: isPending ? 'not-allowed' : 'pointer',
            padding: 0,
            fontFamily: 'var(--font-sans)',
          }}
        >
          <Paperclip size={12} aria-hidden="true" />
          {isPending ? 'Subiendo…' : 'Adjuntar evidencia'}
        </button>
      </form>
    </div>
  );
}
