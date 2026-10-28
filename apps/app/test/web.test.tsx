import { renderRouter, screen } from "expo-router/testing-library";

import { openData } from "@/services/openData";

import { testData } from "./testData";

jest.mock("@/services/openData", () => ({ openData: jest.fn() }));
jest.mock("@/ui/platform", () => ({ IS_WEB: true }));

const APP = "./src/app";
let deckId: string;

beforeEach(async () => {
  const data = await testData();
  jest.mocked(openData).mockResolvedValue(data);
  const deck = await data.library.createDeck("Fiiller");
  deckId = deck.ok ? deck.id : "";
});

describe("web", () => {
  it("asks to sign in before showing decks", async () => {
    await renderRouter(APP, { initialUrl: "/" });
    expect(await screen.findByText("Kartlarını telefona aktarmak için giriş yap")).toBeOnTheScreen();
    expect(screen.getByText("Giriş yap")).toBeOnTheScreen();
    for (const text of ["Fiiller", "Tümünü çalış", "İstatistikler", "Ayarlar", "Sözlük"]) {
      expect(screen.queryByText(text)).toBeNull();
    }
  });

  it("offers bulk add but not study on a deck", async () => {
    await renderRouter(APP, { initialUrl: `/deck/${deckId}` });
    expect(await screen.findByText("Toplu ekle")).toBeOnTheScreen();
    expect(screen.queryByText("Çalış")).toBeNull();
  });

  it("does not open study by address", async () => {
    await renderRouter(APP, { initialUrl: `/study?deckId=${deckId}` });
    await screen.findByText("Kartlarını telefona aktarmak için giriş yap");
    expect(screen.queryByText("Başla")).toBeNull();
  });

  it("leaves dictionary sources out of About", async () => {
    await renderRouter(APP, { initialUrl: "/about" });
    expect(await screen.findByText(/^DilKart/)).toBeOnTheScreen();
    expect(screen.queryByText(/Sözlük paketi/)).toBeNull();
  });
});
