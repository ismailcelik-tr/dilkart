import type { Library, Study } from "@dilkart/core";
import { useFocusEffect } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { openData, type AppData } from "./openData";

const DataContext = createContext<AppData | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>();
  const [error, setError] = useState<unknown>();

  useEffect(() => {
    openData().then(setData, setError);
  }, []);

  if (error !== undefined) {
    throw error;
  }
  if (data === undefined) {
    return null;
  }
  return <DataContext.Provider value={data}>{children}</DataContext.Provider>;
}

function useData(): AppData {
  const data = useContext(DataContext);
  if (data === null) {
    throw new Error("used outside LibraryProvider");
  }
  return data;
}

export const useLibrary = (): Library => useData().library;
export const useStudy = (): Study => useData().study;

/** Reloads on every focus so a list shows edits made on the screen above it. */
export function useLoad<T>(load: (library: Library) => Promise<T>): T | undefined {
  const library = useLibrary();
  const [value, setValue] = useState<T>();

  useFocusEffect(
    useCallback(() => {
      let live = true;
      load(library).then((v) => {
        if (live) {
          setValue(v);
        }
      });
      return () => {
        live = false;
      };
    }, [library, load]),
  );
  return value;
}
