// src/components/SupplierEntryForm.tsx
'use client';

import { useState } from 'react';

export default function SupplierEntryForm() {
  const [formData, setFormData] = useState({
    electricityValue: '',
    electricityUnit: 'kWh',
    transportValue: '',
    transportUnit: 'gallons'
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Aquí posteriormente se conectará con Supabase para insertar en environmental_evaluations
    console.log('Datos listos para enviar a Supabase y al Motor Funcional:', formData);
    alert('Consumo registrado exitosamente. Pendiente de cálculo CO2e.');
  };

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
      <h2 className="text-2xl font-bold mb-6 text-gray-800">Registro de Consumos del Proveedor</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Sección de Electricidad */}
        <div className="p-4 border rounded bg-gray-50">
          <h3 className="text-lg font-semibold mb-3">Consumo Eléctrico (Alcance 2)</h3>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">Cantidad Bruta</label>
              <input 
                type="number" 
                name="electricityValue"
                value={formData.electricityValue}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                placeholder="Ej. 1500"
              />
            </div>
            <div className="w-1/3">
              <label className="block text-sm font-medium text-gray-700">Unidad</label>
              <select 
                name="electricityUnit"
                value={formData.electricityUnit}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
              >
                <option value="kWh">kWh</option>
                <option value="MWh">MWh</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sección de Transporte */}
        <div className="p-4 border rounded bg-gray-50">
          <h3 className="text-lg font-semibold mb-3">Consumo de Transporte (Alcance 1)</h3>
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700">Combustible Consumido</label>
              <input 
                type="number" 
                name="transportValue"
                value={formData.transportValue}
                onChange={handleChange}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                placeholder="Ej. 50"
              />
            </div>
            <div className="w-1/3">
              <label className="block text-sm font-medium text-gray-700">Unidad</label>
              <select 
                name="transportUnit"
                value={formData.transportUnit}
                onChange={handleChange}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
              >
                <option value="liters">Litros</option>
                <option value="gallons">Galones</option>
              </select>
            </div>
          </div>
        </div>

        <button 
          type="submit" 
          className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 transition duration-200 font-bold"
        >
          Registrar Evaluación
        </button>
      </form>
    </div>
  );
}