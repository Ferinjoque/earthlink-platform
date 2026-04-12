import { supabase } from './supabase/client';

export class EmissionFactorService {
  
  /**
   * Función para OBTENER los factores de conversión actuales
   
   */
  static async getLatestFactors() {

    const { data, error } = await supabase
      .from('emission_factors') 
      .select('*')
      .single(); 

    if (error) {
      console.error("Error al obtener los factores de emisión:", error);
      throw new Error(error.message);
    }


    return data;
  }
}