import { adoptGuest, rpcRemote, type Library, type Settings, type Stats, type Study, type WeakWords } from "@dilkart/core";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { router, useFocusEffect } from "expo-router";
import { Storage } from "expo-sqlite/kv-store";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AppState } from "react-native";

import { createSupabase } from "@/drivers/supabase";

import { GUEST_DB, userDb } from "./databases";
import { deleteData, openData, type AppData } from "./openData";
import { refreshReminders } from "./reminders";
import { SyncProblem, SyncService, type SyncStatus } from "./syncService";

const supabase = createSupabase();
// Set when the user keeps guest cards out of this account, so we do not ask again.
const keptGuestKey = (uid: string) => `guest.kept.${uid}`;

export interface Account {
  /** Undefined in builds without a backend: guest only. */
  client?: SupabaseClient;
  email?: string;
  status: SyncStatus;
  /** Guest cards waiting for the user's answer before joining a non-empty account. */
  guestCards?: number;
  syncNow: () => Promise<void>;
  adopt: () => Promise<void>;
  keepGuest: () => Promise<void>;
  signOut: () => Promise<void>;
}

const DataContext = createContext<AppData | null>(null);
const AccountContext = createContext<Account | null>(null);

export function LibraryProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(supabase ? undefined : null);
  const [data, setData] = useState<AppData>();
  const [error, setError] = useState<unknown>();
  const [status, setStatus] = useState<SyncStatus>({ pending: 0, failed: 0, problem: SyncProblem.None });
  const [guestCards, setGuestCards] = useState<number>();
  const service = useRef<SyncService>(undefined);
  const guest = useRef<AppData>(undefined);
  const current = useRef<AppData>(undefined);
  // The signed-out account's file, deleted once the guest database replaces it.
  const retiring = useRef<string>(undefined);
  // Work on the account database (sync round, guest check) that must end before it closes.
  const busy = useRef<Promise<unknown>>(Promise.resolve());

  useEffect(() => {
    if (supabase === undefined) {
      return;
    }
    supabase.auth.getSession().then(({ data: d }) => setSession(d.session));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  const uid = session?.user.id;
  const name = session === undefined ? undefined : uid === undefined ? GUEST_DB : userDb(uid);

  // Swap databases without unmounting the screens, so navigation survives sign-in and sign-out.
  useEffect(() => {
    if (name === undefined) {
      return;
    }
    let live = true;
    openData(name).then(async (next) => {
      if (!live) {
        await next.close();
        return;
      }
      const previous = current.current;
      current.current = next;
      setData(next);
      if (previous !== undefined && previous !== next) {
        await busy.current;
        await previous.close();
        if (retiring.current === previous.name) {
          retiring.current = undefined;
          await deleteData(previous.name);
        }
      }
    }, setError);
    return () => {
      live = false;
    };
  }, [name]);

  /** After the first sync of a sign-in: empty account takes guest data at once, otherwise ask. */
  const offerGuestData = async (account: AppData, id: string, svc: SyncService) => {
    const cancelled = () => service.current !== svc;
    if ((await Storage.getItem(keptGuestKey(id))) !== null || cancelled()) {
      return;
    }
    const g = await openData(GUEST_DB);
    const count = (await g.library.allCards()).length;
    if (count === 0 || cancelled()) {
      await g.close();
      return;
    }
    guest.current = g;
    if ((await account.library.decks()).length === 0) {
      await moveGuest(account);
    } else {
      setGuestCards(count);
      router.push("/account/adopt");
    }
  };

  const moveGuest = async (account: AppData) => {
    const g = guest.current;
    if (g === undefined) {
      return;
    }
    const adopted = await adoptGuest(g.store, account.store);
    await account.study.refresh(adopted.touched);
    await g.close();
    await deleteData(GUEST_DB);
    guest.current = undefined;
    setGuestCards(undefined);
    await service.current?.run();
  };

  const uidOpen = data !== undefined && uid !== undefined && data.name === userDb(uid) ? uid : undefined;

  // Today's reminder must go once the user studies; leaving the app is the moment to know.
  useEffect(() => {
    if (data === undefined) {
      return;
    }
    void refreshReminders(data.stats);
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active" || state === "background") {
        void refreshReminders(data.stats);
      }
    });
    return () => sub.remove();
  }, [data]);

  useEffect(() => {
    if (data === undefined || uidOpen === undefined || supabase === undefined) {
      return;
    }
    const svc = new SyncService(data.store, rpcRemote(supabase), data.study, setStatus);
    service.current = svc;
    svc.start();
    busy.current = svc.run().then(() => offerGuestData(data, uidOpen, svc));
    return () => {
      service.current = undefined;
      busy.current = Promise.all([busy.current, svc.stop()]).catch(() => undefined);
    };
    // offerGuestData only reads refs and setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, uidOpen]);

  const account: Account = {
    client: supabase,
    // Only once the account's database is open; until then screens still hold the guest data.
    email: uidOpen === undefined ? undefined : session?.user.email,
    status,
    guestCards,
    syncNow: async () => service.current?.run(),
    adopt: async () => data && moveGuest(data),
    keepGuest: async () => {
      if (uid !== undefined) {
        await Storage.setItem(keptGuestKey(uid), "1");
      }
      await guest.current?.close();
      guest.current = undefined;
      setGuestCards(undefined);
    },
    signOut: async () => {
      if (supabase === undefined || uid === undefined) {
        return;
      }
      retiring.current = userDb(uid);
      await supabase.auth.signOut({ scope: "local" });
    },
  };

  if (error !== undefined) {
    throw error;
  }
  if (data === undefined) {
    return null;
  }
  return (
    <AccountContext.Provider value={account}>
      <DataContext.Provider value={data}>{children}</DataContext.Provider>
    </AccountContext.Provider>
  );
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
export const useSettings = (): Settings => useData().settings;
export const useWeakWords = (): WeakWords => useData().weak;
export const useStats = (): Stats => useData().stats;

/** Changes the server rejected for good (plan section 16, Aşama 7). Only signed-in use syncs. */
export function useFailedCount(): () => Promise<number> {
  const { store } = useData();
  return useCallback(async () => (await store.counts()).failed, [store]);
}
export const useDictionary = () => {
  const { dictionary, recent } = useData();
  return { dictionary, recent };
};

export function useAccount(): Account {
  const account = useContext(AccountContext);
  if (account === null) {
    throw new Error("used outside LibraryProvider");
  }
  return account;
}

/** Reloads on every focus so a list shows edits made on the screen above it; `reload` for edits made here. */
export function useLoad<T>(load: (library: Library) => Promise<T>): [T | undefined, () => void] {
  const library = useLibrary();
  const [value, setValue] = useState<T>();
  const reload = () => void load(library).then(setValue);

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
  return [value, reload];
}
