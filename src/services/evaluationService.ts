import { supabase } from './supabase/client';


import { calculateCarbonFootprint } from '../lib/calculators/sustainabilityCalculators';

export class EvaluationService {
  
  static async createEvaluation(metrics: any, factors: any, proveedorId: string) {
    
    // --- PASO A: CÁLCULO DE SUSTENTABILIDAD  ---
    const resultadoCalculo = calculateCarbonFootprint(metrics, factors);

    // --- PASO B: LÓGICA DE BASE DE DATOS  ---
   
    const { data, error } = await supabase
      .from('environmental_evaluations') 
      .insert([
        {
          supplier_id: proveedorId,
          huella_carbono_total: resultadoCalculo.totalCo2e,
          puntaje_riesgo: resultadoCalculo.riskScore,
          emisiones_electricidad: resultadoCalculo.breakdown.electricityCo2e,
          emisiones_transporte: resultadoCalculo.breakdown.transportCo2e,
          fecha_evaluacion: new Date().toISOString() 
        }
      ])
      .select();

    if (error) {
      console.error("Error al guardar la evaluación:", error);
      throw new Error(error.message);
    }

    return data;
  }
}