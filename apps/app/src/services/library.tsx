import type { Library } from "@dilkart/core";
import { useFocusEffect } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { openLibrary } from "./openLibrary";

const LibraryContext = createContext<Library | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [library, setLibrary] = useState<Library>();
  const [error, setError] = useState<unknown>();

  useEffect(() => {
    openLibrary().then(setLibrary, setError);
  }, []);

  if (error !== undefined) {
    throw error;
  }
  if (library === undefined) {
    return null;
  }
  return <LibraryContext.Provider value={library}>{children}</LibraryContext.Provider>;
}

export function useLibrary(): Library {
  const library = useContext(LibraryContext);
  if (library === null) {
    throw new Error("useLibrary outside LibraryProvider");
  }
  return library;
}

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
