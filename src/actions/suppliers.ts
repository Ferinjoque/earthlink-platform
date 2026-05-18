'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/services/supabase/server';

const createSchema = z.object({
  nombre: z.string().min(1, 'El nombre es obligatorio').max(200),
  categoria: z.string().min(1, 'La categoría es obligatoria').max(100),
  contacto: z.string().email('Correo inválido').or(z.literal('')).optional(),
  ruc: z.string().max(20).optional(),
  organization_id: z.string().uuid('ID de organización inválido'),
});

const updateSchema = z.object({
  id: z.string().uuid(),
  nombre: z.string().min(1, 'El nombre es obligatorio').max(200),
  categoria: z.string().min(1, 'La categoría es obligatoria').max(100),
  contacto: z.string().email('Correo inválido').or(z.literal('')).optional(),
  ruc: z.string().max(20).optional(),
});

export interface SupplierActionState {
  error?: string;
  success?: boolean;
}

type MembershipData = { role: string };
type SupplierData = { organization_id: string };

export async function createSupplier(
  _prev: SupplierActionState | null,
  formData: FormData,
): Promise<SupplierActionState> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const parsed = createSchema.safeParse({
    nombre: formData.get('nombre'),
    categoria: formData.get('categoria'),
    contacto: formData.get('contacto') ?? '',
    ruc: formData.get('ruc') ?? '',
    organization_id: formData.get('organization_id'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Error de validación' };
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
  } as never);

  if (error) return { error: error.message };

  revalidatePath('/suppliers');
  return { success: true };
}

export async function updateSupplier(
  _prev: SupplierActionState | null,
  formData: FormData,
): Promise<SupplierActionState> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const parsed = updateSchema.safeParse({
    id: formData.get('id'),
    nombre: formData.get('nombre'),
    categoria: formData.get('categoria'),
    contacto: formData.get('contacto') ?? '',
    ruc: formData.get('ruc') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Error de validación' };
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
    } as never)
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/suppliers');
  return { success: true };
}

export async function archiveSupplier(
  _prev: SupplierActionState | null,
  formData: FormData,
): Promise<SupplierActionState> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const id = formData.get('id');
  if (typeof id !== 'string' || !id) return { error: 'ID de proveedor requerido' };

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

  if (!membership || membership.role !== 'admin') {
    return { error: 'Solo un administrador puede archivar proveedores' };
  }

  const { error } = await supabase
    .from('suppliers')
    .update({ archived_at: new Date().toISOString() } as never)
    .eq('id', id);

  if (error) return { error: error.message };

  revalidatePath('/suppliers');
  return { success: true };
}
