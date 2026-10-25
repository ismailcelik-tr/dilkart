import { fireEvent, renderRouter, screen } from "expo-router/testing-library";
import { Alert, Appearance, type AlertButton } from "react-native";

import { openData } from "@/services/openData";
import { savedScheme } from "@/services/prefs";
import type { Library } from "@dilkart/core";

import { testData } from "./testData";

jest.mock("@/services/openData", () => ({ openData: jest.fn() }));

const APP = "./src/app";
let lib: Library;

beforeEach(async () => {
  const data = await testData();
  lib = data.library;
  jest.mocked(openData).mockResolvedValue(data);
});

/** Presses the destructive button of the next confirmation. */
function confirmNextAlert() {
  jest.spyOn(Alert, "alert").mockImplementationOnce((_title, _message, buttons?: AlertButton[]) => {
    buttons?.find((b) => b.style === "destructive")?.onPress?.();
  });
}

async function deckWithCard() {
  const deck = await lib.createDeck("Fiiller");
  const card = deck.ok && (await lib.createCard(deck.id, { front: "go", meanings: [{ tr: "gitmek" }] }));
  if (!deck.ok || !card || !card.ok) {
    throw new Error("setup failed");
  }
  return { deckId: deck.id, cardId: card.id };
}

describe("decks", () => {
  it("creates a deck from the empty state", async () => {
    await renderRouter(APP, { initialUrl: "/" });
    await fireEvent.press(await screen.findByText("Deste oluştur"));
    await fireEvent.changeText(await screen.findByLabelText("Deste adı"), "Fiiller");
    await fireEvent.press(screen.getByText("Kaydet"));

    expect(await screen.findByText("Fiiller")).toBeOnTheScreen();
    expect(screen.getByText("0 kart")).toBeOnTheScreen();
  });

  it("rejects an empty name", async () => {
    await renderRouter(APP, { initialUrl: "/deck/new" });
    await fireEvent.press(await screen.findByText("Kaydet"));
    expect(await screen.findByText("Deste adı boş olamaz.")).toBeOnTheScreen();
  });

  it("renames a deck", async () => {
    const { deckId } = await deckWithCard();
    await renderRouter(APP, { initialUrl: `/deck/${deckId}` });
    await fireEvent.press(await screen.findByText("Yeniden adlandır"));
    await fireEvent.changeText(await screen.findByLabelText("Deste adı"), "Eylemler");
    await fireEvent.press(screen.getByText("Kaydet"));
    expect((await lib.decks())[0]?.name).toBe("Eylemler");
  });

  it("deletes a deck with its cards after confirming", async () => {
    const { deckId, cardId } = await deckWithCard();
    await renderRouter(APP, { initialUrl: `/deck/${deckId}` });
    confirmNextAlert();
    await fireEvent.press(await screen.findByText("Desteyi sil"));

    expect(Alert.alert).toHaveBeenCalledWith("Desteyi sil", "Fiiller ve içindeki 1 kart silinecek.", expect.any(Array));
    expect(await screen.findByText("Deste oluştur")).toBeOnTheScreen();
    expect(await lib.card(cardId)).toBeUndefined();
  });
});

describe("deck list", () => {
  it("switches to dark appearance and remembers it", async () => {
    const apply = jest.spyOn(Appearance, "setColorScheme");
    await renderRouter(APP, { initialUrl: "/" });
    await fireEvent(await screen.findByLabelText("Koyu görünüm"), "valueChange", true);

    expect(apply).toHaveBeenCalledWith("dark");
    expect(savedScheme()).toBe("dark");
  });

  it("covers the swipe action with an opaque row", async () => {
    await deckWithCard();
    await renderRouter(APP, { initialUrl: "/" });

    expect(await screen.findByTestId("swipe-row")).toHaveStyle({ backgroundColor: "#FFFFFF" });
  });

  it("deletes a deck from its swipe action after confirming", async () => {
    const { cardId } = await deckWithCard();
    await renderRouter(APP, { initialUrl: "/" });
    confirmNextAlert();
    await fireEvent.press(await screen.findByLabelText("Sil: Fiiller"));

    expect(Alert.alert).toHaveBeenCalledWith("Desteyi sil", "Fiiller ve içindeki 1 kart silinecek.", expect.any(Array));
    expect(await screen.findByText("Deste oluştur")).toBeOnTheScreen();
    expect(await lib.card(cardId)).toBeUndefined();
  });
});

describe("cards", () => {
  it("adds a card with two meanings", async () => {
    const { deckId } = await deckWithCard();
    await renderRouter(APP, { initialUrl: `/deck/${deckId}` });
    await fireEvent.press(await screen.findByText("Kart ekle"));
    await fireEvent.changeText(await screen.findByLabelText("Ön yüz"), "run");
    await fireEvent.changeText(screen.getByLabelText("Anlam 1"), "koşmak");
    await fireEvent.press(screen.getByText("Anlam ekle"));
    await fireEvent.changeText(screen.getByLabelText("Anlam 2"), "işletmek");
    await fireEvent.press(screen.getByText("Kaydet"));

    expect(await screen.findByText("run")).toBeOnTheScreen();
    expect(screen.getByText("koşmak, işletmek")).toBeOnTheScreen();
  });

  it("shows validation errors", async () => {
    const { deckId } = await deckWithCard();
    await renderRouter(APP, { initialUrl: `/card/new?deckId=${deckId}` });
    await fireEvent.press(await screen.findByText("Kaydet"));
    expect(await screen.findByText("Ön yüz boş olamaz.")).toBeOnTheScreen();
    expect(screen.getByText("En az bir anlam girin.")).toBeOnTheScreen();
  });

  it("edits a card", async () => {
    const { cardId } = await deckWithCard();
    await renderRouter(APP, { initialUrl: `/card/${cardId}` });
    await fireEvent.changeText(await screen.findByLabelText("Örnek cümle (İngilizce)"), "Let's go.");
    await fireEvent.press(screen.getByText("Kaydet"));
    expect(await screen.findByText("Fiiller")).toBeOnTheScreen();
    expect((await lib.card(cardId))?.exampleEn).toBe("Let's go.");
  });

  it("moves a card to another deck", async () => {
    const { cardId } = await deckWithCard();
    const other = await lib.createDeck("Tekrar");
    await renderRouter(APP, { initialUrl: `/card/${cardId}` });
    await fireEvent.press(await screen.findByText("Taşı"));
    await fireEvent.press(await screen.findByText("Tekrar"));
    await screen.findByText("Kaydet");
    expect((await lib.card(cardId))?.deckId).toBe(other.ok && other.id);
  });

  it("deletes a card after confirming", async () => {
    const { deckId, cardId } = await deckWithCard();
    await renderRouter(APP, { initialUrl: `/card/${cardId}` });
    confirmNextAlert();
    await fireEvent.press(await screen.findByText("Kartı sil"));
    expect(await lib.card(cardId)).toBeUndefined();
    expect((await lib.cards(deckId)).length).toBe(0);
  });
});
