'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createServerClient } from '@/services/supabase/server';

const createPeriodSchema = z
  .object({
    supplier_id: z.string().uuid('ID de proveedor inválido'),
    label: z.string().min(1, 'El label es obligatorio').max(50),
    fecha_inicio: z.string().min(1, 'La fecha de inicio es obligatoria'),
    fecha_fin: z.string().min(1, 'La fecha de fin es obligatoria'),
  })
  .refine(
    (d) => new Date(d.fecha_fin) > new Date(d.fecha_inicio),
    { message: 'La fecha de fin debe ser posterior a la fecha de inicio', path: ['fecha_fin'] },
  );

export interface PeriodActionState {
  error?: string;
  success?: boolean;
}

type SupplierData = { organization_id: string };
type MembershipData = { role: string };

export async function createPeriod(
  _prev: PeriodActionState | null,
  formData: FormData,
): Promise<PeriodActionState> {
  const supabase = await createServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: 'No autenticado' };

  const parsed = createPeriodSchema.safeParse({
    supplier_id: formData.get('supplier_id'),
    label: formData.get('label'),
    fecha_inicio: formData.get('fecha_inicio'),
    fecha_fin: formData.get('fecha_fin'),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Error de validación' };
  }

  const { supplier_id, label, fecha_inicio, fecha_fin } = parsed.data;

  const { data: rawSupplier } = await supabase
    .from('suppliers')
    .select('organization_id')
    .eq('id', supplier_id)
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
    return { error: 'Sin permisos para crear periodos en esta organización' };
  }

  const { error } = await supabase.from('reporting_periods').insert({
    supplier_id,
    label,
    start_date: fecha_inicio,
    end_date: fecha_fin,
    status: 'open' as const,
  });

  if (error) return { error: error.message };

  revalidatePath(`/suppliers/${supplier_id}`);
  revalidatePath('/audit');
  return { success: true };
}
