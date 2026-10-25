// Device-only preferences; not synced.
import type { Module } from "@dilkart/core";
import { Storage } from "expo-sqlite/kv-store";

const MODULE_KEY = "study.module";

export async function lastModule(): Promise<Module | undefined> {
  const value = await Storage.getItem(MODULE_KEY);
  return value === null ? undefined : (Number(value) as Module);
}

export async function rememberModule(module: Module): Promise<void> {
  await Storage.setItem(MODULE_KEY, String(module));
}
