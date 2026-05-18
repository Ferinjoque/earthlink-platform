import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';
import { SupplierTable } from '@/components/suppliers/SupplierTable';
import type { MembershipRow, SupplierRow } from '@/types/database';
import { Building2 } from 'lucide-react';

export const metadata: Metadata = { title: 'Proveedores' };

export default async function ProveedoresPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rawMemberships } = await supabase
    .from('memberships')
    .select('organization_id, role')
    .eq('user_id', user.id);
  const memberships = (rawMemberships ?? []) as Pick<MembershipRow, 'organization_id' | 'role'>[];

  const orgIds = [
    ...new Set(memberships.map((m) => m.organization_id).filter((id): id is string => !!id)),
  ];
  const primaryOrgId = orgIds[0] ?? '';

  const suppliersData: SupplierRow[] = [];
  if (orgIds.length) {
    const { data } = await supabase
      .from('suppliers')
      .select(
        'id, name, category, contact_email, ruc, organization_id, created_at, updated_at, archived_at',
      )
      .in('organization_id', orgIds)
      .is('archived_at', null)
      .order('name', { ascending: true });
    if (data) suppliersData.push(...(data as SupplierRow[]));
  }

  const nProveedores = suppliersData.length;

  return (
    <>
      <TopBar title="Proveedores" email={user?.email} section="Registro de cadena" />

      <main
        style={{
          padding: 'var(--space-8)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-8)',
          maxWidth: 'var(--max-w-content)',
        }}
      >
        {/* Titular */}
        <section>
          <p className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
            Cadena de suministro
          </p>
          <h2
            style={{
              fontFamily: 'var(--font-serif)',
              fontSize: 'var(--text-3xl)',
              fontWeight: 400,
              fontStyle: 'italic',
              color: 'var(--color-ink-1)',
              margin: '0 0 var(--space-2)',
              letterSpacing: '-0.032em',
              lineHeight: 1.1,
            }}
          >
            Registro de proveedores
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', margin: 0 }}>
            {nProveedores} {nProveedores !== 1 ? 'proveedores activos' : 'proveedor activo'} en tu
            {orgIds.length > 1 ? 's organizaciones' : ' organización'}.
          </p>
        </section>

        {/* Estado vacío global */}
        {orgIds.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 'var(--space-4)',
              padding: 'var(--space-12) var(--space-8)',
              background: 'var(--color-surface-1)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              textAlign: 'center',
            }}
          >
            <span
              style={{
                width: '48px',
                height: '48px',
                borderRadius: 'var(--radius-lg)',
                background: 'var(--color-surface-2)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--color-ink-3)',
              }}
            >
              <Building2 size={22} />
            </span>
            <div>
              <p
                style={{
                  fontWeight: 'var(--fw-semibold)',
                  fontSize: 'var(--text-base)',
                  color: 'var(--color-ink-1)',
                  margin: '0 0 var(--space-2)',
                }}
              >
                Sin organización asociada
              </p>
              <p
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-ink-3)',
                  margin: 0,
                  maxWidth: '40ch',
                }}
              >
                Tu cuenta no está asociada a ninguna organización. Contacta al administrador.
              </p>
            </div>
          </div>
        ) : (
          <SupplierTable suppliers={suppliersData} organizationId={primaryOrgId} />
        )}
      </main>
    </>
  );
}
