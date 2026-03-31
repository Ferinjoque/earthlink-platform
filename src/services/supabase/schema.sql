-- 1. Tabla de Empresas Clientes (Los que contratan la auditoría)
CREATE TABLE public.companies (
                                  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                                  ruc VARCHAR(11) UNIQUE NOT NULL,
                                  name VARCHAR(255) NOT NULL,
                                  industry VARCHAR(100) NOT NULL,
                                  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabla de Proveedores (Los que serán evaluados)
CREATE TABLE public.suppliers (
                                  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                                  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
                                  name VARCHAR(255) NOT NULL,
                                  category VARCHAR(100) NOT NULL,
                                  contact_email VARCHAR(255) NOT NULL,
                                  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabla de Factores de Emisión (El insumo para Programación Funcional)
CREATE TABLE public.emission_factors (
                                         id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                                         activity_type VARCHAR(100) NOT NULL UNIQUE, -- ej: 'electricity', 'transport_diesel'
                                         standard_unit VARCHAR(50) NOT NULL,         -- ej: 'kWh', 'liters'
                                         factor_co2e NUMERIC NOT NULL,               -- El multiplicador matemático
                                         last_updated TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Tabla de Evaluaciones de Impacto (El registro de cada auditoría)
CREATE TABLE public.environmental_evaluations (
                                                  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
                                                  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE CASCADE,
                                                  evaluation_period VARCHAR(50) NOT NULL,     -- ej: 'Q1-2026'

    -- Datos Crudos ingresados por el proveedor
                                                  raw_electricity_value NUMERIC DEFAULT 0,
                                                  raw_electricity_unit VARCHAR(50),           -- ej: 'MWh' (tendrá que ser estandarizado a kWh)
                                                  raw_transport_value NUMERIC DEFAULT 0,
                                                  raw_transport_unit VARCHAR(50),             -- ej: 'gallons' (tendrá que ser estandarizado a liters)

    -- Resultados procesados por lógica backend
                                                  total_co2e_emissions NUMERIC DEFAULT 0,
                                                  risk_score NUMERIC DEFAULT 0,               -- Puntaje de 0 a 100
                                                  status VARCHAR(50) DEFAULT 'pending',       -- 'pending', 'calculated', 'audited'

                                                  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
                                                  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Activar Row Level Security (RLS)
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emission_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environmental_evaluations ENABLE ROW LEVEL SECURITY;

-- 6. Políticas temporales de desarrollo (Permitir todo temporalmente mientras se programa)
CREATE POLICY "Allow all access during development" ON public.companies FOR ALL USING (true);
CREATE POLICY "Allow all access during development" ON public.suppliers FOR ALL USING (true);
CREATE POLICY "Allow all access during development" ON public.emission_factors FOR ALL USING (true);
CREATE POLICY "Allow all access during development" ON public.environmental_evaluations FOR ALL USING (true);