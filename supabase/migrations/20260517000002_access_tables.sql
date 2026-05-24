-- =============================================================================
-- Migración 002: Tablas de acceso / autenticación (3 tablas)
-- Organizaciones, Proveedores, Membresías
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 6. organizations
-- ---------------------------------------------------------------------------
CREATE TABLE public.organizations (
  id         uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text        NOT NULL,
  industry   text        NOT NULL,
  ruc        text,
  country    text        NOT NULL DEFAULT 'PE',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE  public.organizations IS 'EarthLink client companies. Each organization owns suppliers.';
COMMENT ON COLUMN public.organizations.ruc IS 'Peruvian tax ID (RUC). Optional for non-PE entities.';

-- ---------------------------------------------------------------------------
-- 7. suppliers
-- ---------------------------------------------------------------------------
CREATE TABLE public.suppliers (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name            text        NOT NULL,
  category        text        NOT NULL,
  contact_email   text,
  ruc             text,
  created_at      timestamptz DEFAULT now() NOT NULL,
  updated_at      timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.suppliers IS 'Supply-chain entities within an organization whose emissions are audited.';

CREATE INDEX idx_suppliers_org ON public.suppliers (organization_id);

-- ---------------------------------------------------------------------------
-- 8. memberships
-- ---------------------------------------------------------------------------
CREATE TABLE public.memberships (
  id              uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id uuid        NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  role            text        NOT NULL CHECK (role IN ('supplier', 'consultant', 'admin')),
  supplier_id     uuid        REFERENCES public.suppliers(id) ON DELETE SET NULL,
  invited_at      timestamptz DEFAULT now() NOT NULL,
  accepted_at     timestamptz,

  UNIQUE (user_id, organization_id),
  CONSTRAINT ck_supplier_role_has_supplier CHECK (
    role <> 'supplier' OR supplier_id IS NOT NULL
  )
);

COMMENT ON TABLE  public.memberships IS 'RBAC link: user ↔ organization with role. supplier role requires supplier_id.';
COMMENT ON COLUMN public.memberships.role IS 'supplier: data entry for one supplier | consultant: read-all for org | admin: full control';

CREATE INDEX idx_memberships_user ON public.memberships (user_id);
CREATE INDEX idx_memberships_org  ON public.memberships (organization_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_organizations_updated_at
  BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();

CREATE TRIGGER trg_suppliers_updated_at
  BEFORE UPDATE ON public.suppliers
  FOR EACH ROW EXECUTE FUNCTION public.fn_set_updated_at();
