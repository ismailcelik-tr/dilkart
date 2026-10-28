import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Alert, type AlertButton } from "react-native";

import { GUEST_DB, userDb } from "@/services/databases";
import { deleteData, openData } from "@/services/openData";

import { FakeSupabase } from "./fakeSupabase";
import { testData } from "./testData";

const mockSupabase = new FakeSupabase();
jest.mock("@/drivers/supabase", () => ({ createSupabase: () => mockSupabase }));
jest.mock("@/services/openData", () => ({ openData: jest.fn(), deleteData: jest.fn() }));

const APP = "./src/app";
const EMAIL = "ali@example.com";
const PASSWORD = "pass1234";
let dir: string;
const pathOf = (name: string) => join(dir, name);
const exists = (name: string) => existsSync(pathOf(name));

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dilkart-"));
  Object.assign(mockSupabase, { session: null, rows: [], pushed: [], deleted: [], outage: false, gate: undefined });
  mockSupabase.users.clear();
  jest.mocked(openData).mockImplementation(async (name = GUEST_DB) => testData(undefined, name, pathOf(name)));
  jest.mocked(deleteData).mockImplementation(async (name) => rmSync(pathOf(name), { force: true }));
});

afterEach(() => jest.restoreAllMocks());

async function signIn() {
  const uid = mockSupabase.user(EMAIL, PASSWORD);
  await renderRouter(APP, { initialUrl: "/account" });
  await fireEvent.press(await screen.findByText("Giriş yap"));
  await fireEvent.changeText(await screen.findByLabelText("E-posta"), EMAIL);
  await fireEvent.changeText(screen.getByLabelText("Şifre"), PASSWORD);
  await fireEvent.press(screen.getByText("Giriş yap"));
  await screen.findByText(/Son eşitleme: /);
  return uid;
}

function confirmNextAlert() {
  jest.spyOn(Alert, "alert").mockImplementationOnce((_t, _m, buttons?: AlertButton[]) => {
    buttons?.find((b) => b.style === "destructive")?.onPress?.();
  });
}

describe("account deletion", () => {
  it("deletes the account and its local data", async () => {
    const uid = await signIn();
    confirmNextAlert();
    await fireEvent.press(screen.getByText("Hesabı sil"));

    expect(Alert.alert).toHaveBeenCalledWith(
      "Hesabı sil",
      "Hesabın, sunucudaki tüm kartların ve çalışma geçmişin kalıcı olarak silinecek. Geri alınamaz.",
      expect.any(Array),
    );
    await waitFor(() => expect(exists(userDb(uid))).toBe(false));
    expect(mockSupabase.deleted).toEqual([uid]);
    expect(await screen.findByText("Hesap oluştur")).toBeOnTheScreen();
  });

  it("keeps everything when deletion fails", async () => {
    const uid = await signIn();
    mockSupabase.outage = true;
    confirmNextAlert();
    await fireEvent.press(screen.getByText("Hesabı sil"));

    expect(await screen.findByText("Hesap silinemedi; bağlantını kontrol edip yeniden dene.")).toBeOnTheScreen();
    expect(screen.getByText(EMAIL)).toBeOnTheScreen();
    expect(exists(userDb(uid))).toBe(true);
  });

  it("points to the web for export on phones", async () => {
    await signIn();
    expect(screen.getByText("Verilerini dilkart.fly.dev'den indirebilirsin.")).toBeOnTheScreen();
    expect(screen.queryByText("Verilerimi indir")).toBeNull();
  });
});
