import { supabase } from './supabase/client';

// Creamos una Clase para agrupar todas las acciones de los Proveedores (Paradigma POO)
export class SupplierService {
  
  /**
   * Función para CREAR un nuevo proveedor en la base de datos
   */
  static async createSupplier(proveedorData: any) {
    
    const { data, error } = await supabase
      .from('suppliers') 
      .insert([
        {
          
          name: proveedorData.nombre,
          category: proveedorData.categoria
        }
      ])
      .select(); 

    
    if (error) {
      console.error("Error al crear proveedor:", error);
      throw new Error(error.message);
    }

    
    return data;

  }
  // 2. READ  - Traer todos los proveedores para mostrarlos en el Dashboard
  static async getSuppliers() {
 
    const { data, error } = await supabase
      .from('suppliers')
      .select('*');

    if (error) {
      console.error("Error al obtener proveedores:", error);
      throw new Error(error.message);
    }
    return data;
  }

  // 3. UPDATE (Actualizar) - Modificar un proveedor que ya existe
  static async updateSupplier(id: string, nuevosDatos: any) {
    
    const { data, error } = await supabase
      .from('suppliers')
      .update({ name: nuevosDatos.nombre, category: nuevosDatos.categoria })
      .eq('id', id)
      .select();

    if (error) {
      console.error("Error al actualizar proveedor:", error);
      throw new Error(error.message);
    }
    return data;
  }

  // 4. DELETE (Borrar) - Eliminar un proveedor de la base de datos
  static async deleteSupplier(id: string) {
 
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error("Error al eliminar proveedor:", error);
      throw new Error(error.message);
    }
    return true;
  }
  
}