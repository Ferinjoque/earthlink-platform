import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/services/supabase/server';
import { TopBar } from '@/components/shell/TopBar';
import { User, Building2, Shield } from 'lucide-react';
import type { MembershipRow, OrganizationRow } from '@/types/database';

export const metadata: Metadata = { title: 'Configuración' };

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  consultant: 'Consultor',
  supplier: 'Proveedor',
};

export default async function ConfiguracionPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: rawMemberships } = await supabase
    .from('memberships')
    .select('role, organization_id')
    .eq('user_id', user.id)
    .limit(1);

  const memberships = (rawMemberships ?? []) as Pick<MembershipRow, 'role' | 'organization_id'>[];
  const membership = memberships[0];
  const role = membership?.role ?? 'supplier';
  const roleLabel = ROLE_LABELS[role] ?? role;

  let orgName = '—';
  let orgCountry = '—';
  let orgIndustry = '—';

  if (membership?.organization_id) {
    const { data: rawOrg } = await supabase
      .from('organizations')
      .select('name, country, industry')
      .eq('id', membership.organization_id)
      .maybeSingle();

    const org = rawOrg as Pick<OrganizationRow, 'name' | 'country' | 'industry'> | null;
    if (org) {
      orgName = org.name;
      orgCountry = org.country;
      orgIndustry = org.industry;
    }
  }

  const email = user.email ?? '—';
  const createdAt = user.created_at
    ? new Date(user.created_at).toLocaleDateString('es-PE', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : '—';

  return (
    <>
      <TopBar title="Configuración" email={email} section="Cuenta y organización" />

      <main
        style={{
          padding: 'var(--space-8)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-8)',
          maxWidth: '720px',
        }}
      >
        {/* Titular */}
        <section className="animate-fade-up stagger-1">
          <p className="eyebrow" style={{ marginBottom: 'var(--space-3)' }}>
            Cuenta y organización
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
            Configuración de la cuenta
          </h2>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)', margin: 0 }}>
            Información de tu cuenta y la organización activa.
          </p>
        </section>

        {/* Sección Cuenta */}
        <section
          className="animate-fade-up stagger-2"
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-5) var(--space-6)',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <span
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-accent-soft)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--color-accent)',
              }}
            >
              <User size={16} />
            </span>
            <h3
              style={{
                fontWeight: 'var(--fw-semibold)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-ink-1)',
                margin: 0,
              }}
            >
              Cuenta
            </h3>
          </div>

          <div>
            <FilaInfo etiqueta="Correo electrónico" valor={email} />
            <FilaInfo etiqueta="Miembro desde" valor={createdAt} />
          </div>
        </section>

        {/* Sección Organización */}
        <section
          className="animate-fade-up stagger-3"
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-5) var(--space-6)',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <span
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-accent-soft)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--color-accent)',
              }}
            >
              <Building2 size={16} />
            </span>
            <h3
              style={{
                fontWeight: 'var(--fw-semibold)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-ink-1)',
                margin: 0,
              }}
            >
              Organización
            </h3>
          </div>

          <div>
            <FilaInfo etiqueta="Nombre" valor={orgName} />
            <FilaInfo etiqueta="País" valor={orgCountry} />
            <FilaInfo etiqueta="Industria" valor={orgIndustry} />
          </div>
        </section>

        {/* Sección Rol */}
        <section
          className="animate-fade-up stagger-4"
          style={{
            background: 'var(--color-surface-1)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-3)',
              padding: 'var(--space-5) var(--space-6)',
              borderBottom: '1px solid var(--color-border)',
            }}
          >
            <span
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                background: 'var(--color-accent-soft)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--color-accent)',
              }}
            >
              <Shield size={16} />
            </span>
            <h3
              style={{
                fontWeight: 'var(--fw-semibold)',
                fontSize: 'var(--text-sm)',
                color: 'var(--color-ink-1)',
                margin: 0,
              }}
            >
              Permisos y rol
            </h3>
          </div>

          <div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 'var(--space-4) var(--space-6)',
              }}
            >
              <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)' }}>
                Rol activo
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--fw-semibold)',
                  color: 'var(--color-accent)',
                  background: 'var(--color-accent-soft)',
                  padding: '2px var(--space-3)',
                  borderRadius: 'var(--radius-pill)',
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {roleLabel}
              </span>
            </div>
          </div>
        </section>

      </main>
    </>
  );
}

function FilaInfo({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'var(--space-4) var(--space-6)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <span style={{ fontSize: 'var(--text-sm)', color: 'var(--color-ink-2)' }}>{etiqueta}</span>
      <span
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--color-ink-1)',
          fontWeight: 'var(--fw-medium)',
        }}
      >
        {valor}
      </span>
    </div>
  );
}
