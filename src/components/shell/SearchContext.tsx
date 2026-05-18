'use client';

import { createContext, useContext } from 'react';
import type { ReactNode } from 'react';

export interface SupplierSearchOption {
  id: string;
  name: string;
  category: string;
}

interface SearchContextValue {
  suppliers: SupplierSearchOption[];
}

const SearchContext = createContext<SearchContextValue>({ suppliers: [] });

export function SearchProvider({
  children,
  suppliers,
}: {
  children: ReactNode;
  suppliers: SupplierSearchOption[];
}) {
  return <SearchContext.Provider value={{ suppliers }}>{children}</SearchContext.Provider>;
}

export function useSearchContext(): SearchContextValue {
  return useContext(SearchContext);
}
