import { Table } from "@dilkart/core";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Alert, type AlertButton } from "react-native";

import { GUEST_DB, userDb } from "@/services/databases";
import { deleteData, openData } from "@/services/openData";

import { FakeSupabase } from "./fakeSupabase";
import { testData } from "./testData";

const mockSupabase = new FakeSupabase();
jest.mock("@/drivers/supabase", () => ({ createSupabase: () => mockSupabase, supabaseUrl: "http://test" }));
jest.mock("@/services/openData", () => ({ openData: jest.fn(), deleteData: jest.fn() }));

const APP = "./src/app";
const EMAIL = "ali@example.com";
const PASSWORD = "pass1234";
let files: Map<string, Awaited<ReturnType<typeof testData>>>;

beforeEach(() => {
  files = new Map();
  Object.assign(mockSupabase, { session: null, rows: [], pushed: [], outage: false });
  mockSupabase.users.clear();
  jest.mocked(openData).mockImplementation(async (name = GUEST_DB) => {
    let data = files.get(name);
    if (data === undefined) {
      data = await testData(undefined, name);
      files.set(name, data);
    }
    return data;
  });
  jest.mocked(deleteData).mockImplementation(async (name) => void files.delete(name));
  jest.spyOn(global, "fetch").mockResolvedValue(new Response(null, { headers: { date: new Date().toUTCString() } }));
});

afterEach(() => jest.restoreAllMocks());

async function guestCard(front = "go") {
  const guest = await openData(GUEST_DB);
  let deckId = (await guest.library.decks())[0]?.id;
  if (deckId === undefined) {
    const created = await guest.library.createDeck("Fiiller");
    deckId = created.ok ? created.id : "";
  }
  await guest.library.createCard(deckId, { front, meanings: [{ tr: "gitmek" }] });
}

async function signInVia() {
  await fireEvent.press(await screen.findByText("Giriş yap"));
  await fireEvent.changeText(await screen.findByLabelText("E-posta"), EMAIL);
  await fireEvent.changeText(screen.getByLabelText("Şifre"), PASSWORD);
  await fireEvent.press(screen.getByText("Giriş yap"));
}

describe("account", () => {
  it("creates an account with the e-mailed code", async () => {
    await renderRouter(APP, { initialUrl: "/account" });
    await fireEvent.press(await screen.findByText("Hesap oluştur"));
    await fireEvent.changeText(await screen.findByLabelText("E-posta"), EMAIL);
    await fireEvent.changeText(screen.getByLabelText("Şifre"), PASSWORD);
    await fireEvent.press(screen.getByText("Kayıt ol"));

    expect(await screen.findByText(`${EMAIL} adresine gönderilen 6 haneli kodu gir.`)).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText("Kod"), "123456");
    await fireEvent.press(screen.getByText("Doğrula"));
    expect(await screen.findByText(EMAIL)).toBeOnTheScreen();
  });

  it("explains a wrong code", async () => {
    mockSupabase.user(EMAIL, PASSWORD, false);
    mockSupabase.codes.set(EMAIL, "123456");
    await renderRouter(APP, { initialUrl: `/account/verify?email=${encodeURIComponent(EMAIL)}&kind=signup` });
    await fireEvent.changeText(await screen.findByLabelText("Kod"), "000000");
    await fireEvent.press(screen.getByText("Doğrula"));
    expect(await screen.findByText("Kod hatalı ya da süresi dolmuş.")).toBeOnTheScreen();
  });

  it("holds the resend button for 60 seconds", async () => {
    await renderRouter(APP, { initialUrl: `/account/verify?email=${encodeURIComponent(EMAIL)}&kind=signup` });
    expect(await screen.findByText(/Kodu tekrar gönder \(\d+ sn\)/)).toBeOnTheScreen();
  });

  it("resets a forgotten password with a code", async () => {
    mockSupabase.user(EMAIL, "old-pass1");
    await renderRouter(APP, { initialUrl: "/account/sign-in" });
    await fireEvent.press(await screen.findByText("Şifremi unuttum"));
    await fireEvent.changeText(await screen.findByLabelText("E-posta"), EMAIL);
    await fireEvent.press(screen.getByText("Kod gönder"));
    await fireEvent.changeText(await screen.findByLabelText("Kod"), "654321");
    await fireEvent.press(screen.getByText("Doğrula"));
    await fireEvent.changeText(await screen.findByLabelText("Yeni şifre"), "new-pass2");
    await fireEvent.press(screen.getByText("Şifreyi kaydet"));
    await waitFor(() => expect(mockSupabase.users.get(EMAIL)?.password).toBe("new-pass2"));
  });
});

describe("guest data", () => {
  it("moves guest cards into an empty account and sends them", async () => {
    const uid = mockSupabase.user(EMAIL, PASSWORD);
    await guestCard();
    await renderRouter(APP, { initialUrl: "/account" });
    await signInVia();

    await waitFor(async () => expect(await files.get(userDb(uid))?.library.allCards()).toHaveLength(1));
    await waitFor(() => expect(files.has(GUEST_DB)).toBe(false));
    await waitFor(() => expect(mockSupabase.pushed.some((op) => op.table === Table.Cards)).toBe(true));
  });

  it("asks before adding guest cards to an account with data", async () => {
    const uid = mockSupabase.user(EMAIL, PASSWORD);
    mockSupabase.rows = [{ seq: 1, tbl: Table.Decks, data: { id: "0199c1d2-0000-7000-8000-0000000000d9", name: "Tekrar", field_clock: {} } }];
    await guestCard();
    await renderRouter(APP, { initialUrl: "/account" });
    await signInVia();

    expect(await screen.findByText("Misafirken bu cihaza eklenmiş 1 kart var.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Hesabıma ekle"));
    await waitFor(async () =>
      expect((await files.get(userDb(uid))?.library.decks())?.map((d) => d.name)).toEqual(["Fiiller", "Tekrar"]),
    );
  });

  it("keeps guest cards on the device when declined", async () => {
    mockSupabase.user(EMAIL, PASSWORD);
    mockSupabase.rows = [{ seq: 1, tbl: Table.Decks, data: { id: "0199c1d2-0000-7000-8000-0000000000d9", name: "Tekrar", field_clock: {} } }];
    await guestCard();
    await renderRouter(APP, { initialUrl: "/account" });
    await signInVia();
    await fireEvent.press(await screen.findByText("Bu cihazda bırak"));
    expect(files.has(GUEST_DB)).toBe(true);
  });
});

describe("signed in", () => {
  it("shows the last sync", async () => {
    mockSupabase.user(EMAIL, PASSWORD);
    await renderRouter(APP, { initialUrl: "/account" });
    await signInVia();
    expect(await screen.findByText(/Son eşitleme: /)).toBeOnTheScreen();
  });

  it("warns before signing out with unsent changes, then removes the account's data", async () => {
    const uid = mockSupabase.user(EMAIL, PASSWORD);
    await renderRouter(APP, { initialUrl: "/account" });
    await signInVia();
    await screen.findByText(/Son eşitleme: /);
    mockSupabase.outage = true;
    const account = files.get(userDb(uid));
    await account?.library.createDeck("Çevrimdışı");
    await fireEvent.press(screen.getByText("Şimdi eşitle"));
    await screen.findByText(/1 değişiklik gönderilmedi/);

    jest.spyOn(Alert, "alert").mockImplementationOnce((_t, _m, buttons?: AlertButton[]) => {
      buttons?.find((b) => b.style === "destructive")?.onPress?.();
    });
    await fireEvent.press(screen.getByText("Çıkış yap"));
    expect(Alert.alert).toHaveBeenCalledWith("Çıkış yap", expect.stringContaining("1 değişiklik"), expect.any(Array));
    await waitFor(() => expect(files.has(userDb(uid))).toBe(false));
    expect(await screen.findByText("Hesap oluştur")).toBeOnTheScreen();
  });
});
