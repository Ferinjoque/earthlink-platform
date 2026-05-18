'use client';

import { Fragment, useState, useEffect, useActionState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Pencil, Archive, X, Check, Search } from 'lucide-react';
import {
  createSupplier,
  updateSupplier,
  archiveSupplier,
  CATEGORIAS_VALIDAS,
  type SupplierActionState,
} from '@/actions/suppliers';
import { CATEGORIAS_VALIDAS } from '@/lib/supplier-constants';
import type { SupplierRow } from '@/types/database';

interface Props {
  suppliers: SupplierRow[];
  organizationId: string;
}

const estiloInput = (error?: boolean): React.CSSProperties => ({
  width: '100%',
  padding: 'var(--space-2) var(--space-3)',
  borderRadius: 'var(--radius-md)',
  border: `1px solid ${error ? 'var(--color-signal-hi)' : 'var(--color-border)'}`,
  background: 'var(--color-surface-2)',
  fontSize: 'var(--text-sm)',
  color: 'var(--color-ink-1)',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
});

const estiloSelect = (error?: boolean): React.CSSProperties => ({
  ...estiloInput(error),
  appearance: 'none',
  WebkitAppearance: 'none',
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238B9591'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat',
  backgroundPosition: 'right 10px center',
  paddingRight: 'var(--space-8)',
  cursor: 'pointer',
});

const estiloError: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  color: 'var(--color-signal-hi)',
  marginTop: '3px',
  fontFamily: 'var(--font-mono)',
};

function FormProveedor({
  organizationId,
  initial,
  onCancel,
  mode,
}: {
  organizationId: string;
  initial?: SupplierRow;
  onCancel: () => void;
  mode: 'create' | 'edit';
}) {
  const action = mode === 'create' ? createSupplier : updateSupplier;
  const [state, formAction, isPending] = useActionState<SupplierActionState | null, FormData>(
    action,
    null,
  );

  // Auto-close on success
  useEffect(() => {
    if (!state?.success) return;
    const t = setTimeout(() => onCancel(), 300);
    return () => clearTimeout(t);
  }, [state?.success, onCancel]);

  const fe = state?.fieldErrors ?? {};

  return (
    <form
      action={formAction}
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 'var(--space-4)',
        padding: 'var(--space-6)',
        background: 'var(--color-accent-soft)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      {mode === 'edit' && <input type="hidden" name="id" value={initial?.id} />}
      <input type="hidden" name="organization_id" value={organizationId} />

      {/* Nombre */}
      <div>
        <label
          htmlFor={`nombre-${mode}`}
          style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-2)', display: 'block', marginBottom: 'var(--space-1)', fontWeight: 500 }}
        >
          Nombre *
        </label>
        <input
          id={`nombre-${mode}`}
          name="nombre"
          required
          defaultValue={initial?.name}
          placeholder="Nombre del proveedor"
          style={estiloInput(!!fe.nombre)}
        />
        {fe.nombre && <p style={estiloError}>{fe.nombre}</p>}
      </div>

      {/* Categoría — dropdown predefinido */}
      <div>
        <label
          htmlFor={`categoria-${mode}`}
          style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-2)', display: 'block', marginBottom: 'var(--space-1)', fontWeight: 500 }}
        >
          Categoría *
        </label>
        <select
          id={`categoria-${mode}`}
          name="categoria"
          required
          defaultValue={initial?.category ?? ''}
          style={estiloSelect(!!fe.categoria)}
        >
          <option value="" disabled>Selecciona una categoría</option>
          {CATEGORIAS_VALIDAS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {fe.categoria && <p style={estiloError}>{fe.categoria}</p>}
      </div>

      {/* Correo */}
      <div>
        <label
          htmlFor={`contacto-${mode}`}
          style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-2)', display: 'block', marginBottom: 'var(--space-1)', fontWeight: 500 }}
        >
          Correo de contacto
        </label>
        <input
          id={`contacto-${mode}`}
          name="contacto"
          type="email"
          defaultValue={initial?.contact_email ?? ''}
          placeholder="contacto@empresa.com"
          style={estiloInput(!!fe.contacto)}
        />
        {fe.contacto && <p style={estiloError}>{fe.contacto}</p>}
      </div>

      {/* RUC */}
      <div>
        <label
          htmlFor={`ruc-${mode}`}
          style={{ fontSize: 'var(--text-xs)', color: 'var(--color-ink-2)', display: 'block', marginBottom: 'var(--space-1)', fontWeight: 500 }}
        >
          RUC <span style={{ color: 'var(--color-ink-3)', fontWeight: 400 }}>(11 dígitos)</span>
        </label>
        <input
          id={`ruc-${mode}`}
          name="ruc"
          inputMode="numeric"
          maxLength={11}
          defaultValue={initial?.ruc ?? ''}
          placeholder="20XXXXXXXXX"
          style={estiloInput(!!fe.ruc)}
        />
        {fe.ruc && <p style={estiloError}>{fe.ruc}</p>}
      </div>

      {/* Error global (no es de campo específico) */}
      {state?.error && !Object.keys(fe).length && (
        <div
          role="alert"
          style={{
            gridColumn: '1 / -1',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-signal-hi)',
            background: 'var(--color-signal-hi-bg)',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          {state.error}
        </div>
      )}

      {state?.success && (
        <div
          style={{
            gridColumn: '1 / -1',
            fontSize: 'var(--text-xs)',
            color: 'var(--color-signal-ok)',
            background: 'var(--color-signal-ok-bg)',
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-mono)',
          }}
        >
          {mode === 'create' ? 'Proveedor creado correctamente.' : 'Cambios guardados.'}
        </div>
      )}

      <div
        style={{
          gridColumn: '1 / -1',
          display: 'flex',
          gap: 'var(--space-2)',
          justifyContent: 'flex-end',
          paddingTop: 'var(--space-2)',
        }}
      >
        <button
          type="button"
          onClick={onCancel}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-ink-2)',
            background: 'transparent',
            border: '1px solid var(--color-border)',
            cursor: 'pointer',
          }}
        >
          <X size={14} />
          Cancelar
        </button>
        <button
          type="submit"
          disabled={isPending}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-1)',
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--fw-medium)',
            color: 'white',
            background: isPending ? 'var(--color-accent-dim)' : 'var(--color-accent)',
            border: 'none',
            cursor: isPending ? 'not-allowed' : 'pointer',
          }}
        >
          <Check size={14} />
          {isPending ? 'Guardando…' : mode === 'create' ? 'Crear proveedor' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

function ConfirmacionArchivo({
  supplier,
  onCancel,
}: {
  supplier: SupplierRow;
  onCancel: () => void;
}) {
  const [state, formAction, isPending] = useActionState<SupplierActionState | null, FormData>(
    archiveSupplier,
    null,
  );

  return (
    <form
      action={formAction}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-3)',
        padding: 'var(--space-3) var(--space-5)',
        background: 'var(--color-signal-hi-bg)',
        borderBottom: '1px solid var(--color-border)',
        flexWrap: 'wrap',
      }}
    >
      <input type="hidden" name="id" value={supplier.id} />
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-signal-hi)', flex: 1 }}>
        Archivar <strong>{supplier.name}</strong> — esta acción oculta al proveedor del listado.
        {state?.error && <span style={{ marginLeft: 'var(--space-3)' }}>{state.error}</span>}
      </span>
      <button
        type="button"
        onClick={onCancel}
        style={{
          padding: 'var(--space-1) var(--space-3)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-xs)',
          color: 'var(--color-ink-2)',
          background: 'transparent',
          border: '1px solid var(--color-border)',
          cursor: 'pointer',
        }}
      >
        Cancelar
      </button>
      <button
        type="submit"
        disabled={isPending}
        style={{
          padding: 'var(--space-1) var(--space-3)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--fw-medium)',
          color: 'white',
          background: 'var(--color-signal-hi)',
          border: 'none',
          cursor: isPending ? 'not-allowed' : 'pointer',
        }}
      >
        {isPending ? 'Archivando…' : 'Confirmar archivo'}
      </button>
    </form>
  );
}

export function SupplierTable({ suppliers, organizationId }: Props) {
  const router = useRouter();
  const [mostrarFormCrear, setMostrarFormCrear] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [archivandoId, setArchivandoId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState('');

  const proveedoresFiltrados = suppliers.filter(
    (s) =>
      s.name.toLowerCase().includes(busqueda.toLowerCase()) ||
      s.category.toLowerCase().includes(busqueda.toLowerCase()),
  );

  return (
    <div>
      {/* Barra de herramientas */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          marginBottom: 'var(--space-4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            flex: 1,
            padding: 'var(--space-2) var(--space-3)',
            borderRadius: 'var(--radius-md)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-surface-1)',
          }}
        >
          <Search size={14} style={{ color: 'var(--color-ink-3)', flexShrink: 0 }} />
          <input
            type="search"
            placeholder="Buscar por nombre o categoría…"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              border: 'none',
              background: 'transparent',
              outline: 'none',
              fontSize: 'var(--text-sm)',
              color: 'var(--color-ink-1)',
              width: '100%',
            }}
          />
          {busqueda && (
            <button
              type="button"
              onClick={() => setBusqueda('')}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--color-ink-3)',
                display: 'flex',
                padding: 0,
              }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setMostrarFormCrear(!mostrarFormCrear);
            setEditandoId(null);
            setArchivandoId(null);
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 'var(--space-2)',
            padding: 'var(--space-2) var(--space-4)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--fw-medium)',
            color: 'white',
            background: 'var(--color-accent)',
            border: 'none',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          <Plus size={15} />
          Nuevo proveedor
        </button>
      </div>

      {/* Tabla */}
      <div
        style={{
          background: 'var(--color-surface-1)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
        }}
      >
        {/* Form crear inline */}
        {mostrarFormCrear && (
          <FormProveedor
            organizationId={organizationId}
            mode="create"
            onCancel={() => setMostrarFormCrear(false)}
          />
        )}

        <style>{`.supplier-row:hover td { background: var(--color-surface-2) !important; }`}</style>

        {proveedoresFiltrados.length === 0 ? (
          <div
            style={{
              padding: 'var(--space-12) var(--space-8)',
              textAlign: 'center',
            }}
          >
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-3)', margin: 0 }}>
              {busqueda
                ? `Sin resultados para "${busqueda}"`
                : 'No hay proveedores. Crea el primero.'}
            </p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
            <thead>
              <tr>
                {['Nombre', 'Categoría', 'RUC', 'Contacto', 'Acciones'].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: 'var(--space-3) var(--space-4)',
                      color: 'var(--color-ink-3)',
                      fontWeight: 600,
                      fontSize: 'var(--text-xs)',
                      fontFamily: 'var(--font-mono)',
                      borderBottom: '1px solid var(--color-border)',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {proveedoresFiltrados.map((s) => (
                <Fragment key={s.id}>
                  <tr
                    className="supplier-row"
                    style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer' }}
                    onClick={() => router.push(`/suppliers/${s.id}`)}
                  >
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-ink-1)', fontWeight: 500 }}>
                      {s.name}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-ink-2)' }}>
                      {s.category}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-ink-3)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
                      {s.ruc ?? '—'}
                    </td>
                    <td style={{ padding: 'var(--space-3) var(--space-4)', color: 'var(--color-ink-2)', fontSize: 'var(--text-xs)' }}>
                      {s.contact_email ?? '—'}
                    </td>
                    <td
                      style={{ padding: 'var(--space-3) var(--space-4)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <button
                          type="button"
                          title="Editar"
                          onClick={() => {
                            setEditandoId(editandoId === s.id ? null : s.id);
                            setArchivandoId(null);
                            setMostrarFormCrear(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px var(--space-2)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--color-ink-2)',
                            background: 'var(--color-surface-2)',
                            border: '1px solid var(--color-border)',
                            cursor: 'pointer',
                          }}
                        >
                          <Pencil size={12} />
                          Editar
                        </button>
                        <button
                          type="button"
                          title="Archivar"
                          onClick={() => {
                            setArchivandoId(archivandoId === s.id ? null : s.id);
                            setEditandoId(null);
                            setMostrarFormCrear(false);
                          }}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '4px var(--space-2)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: 'var(--text-xs)',
                            color: 'var(--color-signal-hi)',
                            background: 'var(--color-signal-hi-bg)',
                            border: '1px solid oklch(50% 0.16 20 / 20%)',
                            cursor: 'pointer',
                          }}
                        >
                          <Archive size={12} />
                          Archivar
                        </button>
                      </div>
                    </td>
                  </tr>
                  {editandoId === s.id && (
                    <tr>
                      <td colSpan={5} style={{ padding: 0 }}>
                        <FormProveedor
                          organizationId={s.organization_id}
                          initial={s}
                          mode="edit"
                          onCancel={() => setEditandoId(null)}
                        />
                      </td>
                    </tr>
                  )}
                  {archivandoId === s.id && (
                    <tr>
                      <td colSpan={5} style={{ padding: 0 }}>
                        <ConfirmacionArchivo
                          supplier={s}
                          onCancel={() => setArchivandoId(null)}
                        />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
