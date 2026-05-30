'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/services/supabase/server';
import { CATEGORIAS_VALIDAS } from '@/lib/supplier-constants';

const rucSchema = z
  .string()
  .regex(/^\d{11}$/, 'El RUC debe tener exactamente 11 dígitos numéricos')
  .or(z.literal(''))
  .optional();

const createSchema = z.object({
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(200),
  categoria: z.enum(CATEGORIAS_VALIDAS, {
    errorMap: () => ({ message: 'Selecciona una categoría válida' }),
  }),
  contacto: z.string().email('Correo electrónico inválido').or(z.literal('')).optional(),
  ruc: rucSchema,
  organization_id: z.string().uuid('ID de organización inválido'),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').max(200),
  categoria: z.enum(CATEGORIAS_VALIDAS, {
    errorMap: () => ({ message: 'Selecciona una categoría válida' }),
  }),
  contacto: z.string().email('Correo electrónico inválido').or(z.literal('')).optional(),
  ruc: rucSchema,
});

type FieldName = 'nombre' | 'categoria' | 'contacto' | 'ruc';

export interface SupplierActionState {
  error?: string;
  fieldErrors?: Partial<Record<FieldName, string>>;
  success?: boolean;
}

type MembershipData = { role: string };
type SupplierData = { organization_id: string };

export async function createSupplier(
  _prev: SupplierActionState | null,
  formData: FormData,
): Promise<SupplierActionState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const parsed = createSchema.safeParse({
    nombre: formData.get('nombre'),
    categoria: formData.get('categoria'),
    contacto: formData.get('contacto') ?? '',
    ruc: formData.get('ruc') ?? '',
    organization_id: formData.get('organization_id'),
  });
  if (!parsed.success) {
    const fieldErrors: SupplierActionState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && field !== 'organization_id') {
        fieldErrors[field as FieldName] = issue.message;
      }
    }
    const firstMsg = parsed.error.issues[0]?.message;
    return firstMsg ? { fieldErrors, error: firstMsg } : { fieldErrors };
  }

  const { nombre, categoria, contacto, ruc, organization_id } = parsed.data;

  const { data: rawMembership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', organization_id)
    .maybeSingle();
  const membership = rawMembership as MembershipData | null;

  if (!membership || !['admin', 'consultant'].includes(membership.role)) {
    return { error: 'Sin permisos para crear proveedores en esta organización' };
  }

  const { error } = await supabase.from('suppliers').insert({
    organization_id,
    name: nombre,
    category: categoria,
    contact_email: contacto || null,
    ruc: ruc || null,
  });

  if (error) return { error: 'Error al guardar el proveedor. Intenta nuevamente.' };

  revalidatePath('/suppliers');
  return { success: true };
}

export async function updateSupplier(
  _prev: SupplierActionState | null,
  formData: FormData,
): Promise<SupplierActionState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const parsed = updateSchema.safeParse({
    id: formData.get('id'),
    nombre: formData.get('nombre'),
    categoria: formData.get('categoria'),
    contacto: formData.get('contacto') ?? '',
    ruc: formData.get('ruc') ?? '',
  });
  if (!parsed.success) {
    const fieldErrors: SupplierActionState['fieldErrors'] = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (typeof field === 'string' && field !== 'id') {
        fieldErrors[field as FieldName] = issue.message;
      }
    }
    const firstMsg = parsed.error.issues[0]?.message;
    return firstMsg ? { fieldErrors, error: firstMsg } : { fieldErrors };
  }

  const { id, nombre, categoria, contacto, ruc } = parsed.data;

  const { data: rawSupplier } = await supabase
    .from('suppliers')
    .select('organization_id')
    .eq('id', id)
    .maybeSingle();
  const supplier = rawSupplier as SupplierData | null;
  if (!supplier) return { error: 'Proveedor no encontrado' };

  const { data: rawMembership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', supplier.organization_id)
    .maybeSingle();
  const membership = rawMembership as MembershipData | null;

  if (!membership || !['admin', 'consultant'].includes(membership.role)) {
    return { error: 'Sin permisos para editar este proveedor' };
  }

  const { error } = await supabase
    .from('suppliers')
    .update({
      name: nombre,
      category: categoria,
      contact_email: contacto || null,
      ruc: ruc || null,
    })
    .eq('id', id)
    .eq('organization_id', supplier.organization_id);

  if (error) return { error: 'Error al guardar el proveedor. Intenta nuevamente.' };

  revalidatePath('/suppliers');
  revalidatePath(`/suppliers/${id}`);
  return { success: true };
}

export async function archiveSupplier(
  _prev: SupplierActionState | null,
  formData: FormData,
): Promise<SupplierActionState> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const id = formData.get('id');
  if (
    typeof id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    return { error: 'ID de proveedor inválido' };

  type SupplierWithArchived = SupplierData & { archived_at: string | null };
  const { data: rawSupplier } = await supabase
    .from('suppliers')
    .select('organization_id, archived_at')
    .eq('id', id)
    .maybeSingle();
  const supplier = rawSupplier as SupplierWithArchived | null;
  if (!supplier) return { error: 'Proveedor no encontrado' };
  if (supplier.archived_at) return { error: 'El proveedor ya está archivado' };

  const { data: rawMembership } = await supabase
    .from('memberships')
    .select('role')
    .eq('user_id', user.id)
    .eq('organization_id', supplier.organization_id)
    .maybeSingle();
  const membership = rawMembership as MembershipData | null;

  if (!membership || membership.role !== 'admin') {
    return { error: 'Solo un administrador puede archivar proveedores' };
  }

  // Bloquear archivado si hay periodos en estados activos
  const { data: activePeriods } = await supabase
    .from('reporting_periods')
    .select('id')
    .eq('supplier_id', id)
    .in('status', ['open', 'calculating'])
    .limit(1);
  if (activePeriods && activePeriods.length > 0) {
    return {
      error:
        'No se puede archivar un proveedor con periodos abiertos o en cálculo. Completa o cierra todos los periodos primero.',
    };
  }

  const { error } = await supabase
    .from('suppliers')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id)
    .eq('organization_id', supplier.organization_id);

  if (error) return { error: 'Error al guardar el proveedor. Intenta nuevamente.' };

  revalidatePath('/suppliers');
  return { success: true };
}
