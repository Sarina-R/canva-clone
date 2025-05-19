"use client";

import { createContext, useContext, useState } from "react";

type DataSource = {
  endpoint: string;
  method: string;
  headers: Record<string, string>;
  data: any;
  timestamp: string;
};

type DataSourceContextType = {
  dataSources: Record<string, DataSource>;
  setDataSources: (dataSources: Record<string, DataSource>) => void;
};

const DataSourceContext = createContext<DataSourceContextType | undefined>(
  undefined,
);

export const DataSourceProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const [dataSources, setDataSources] = useState<Record<string, DataSource>>(
    {},
  );

  return (
    <DataSourceContext.Provider value={{ dataSources, setDataSources }}>
      {children}
    </DataSourceContext.Provider>
  );
};

export const useDataSources = () => {
  const context = useContext(DataSourceContext);
  if (!context) {
    throw new Error("useDataSources must be used within a DataSourceProvider");
  }
  return context;
};
