import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import { openData } from "@/services/openData";

import { testData } from "./testData";

jest.mock("@/services/openData", () => ({ openData: jest.fn() }));

const APP = "./src/app";
let data: Awaited<ReturnType<typeof testData>>;
let deckId: string;

beforeEach(async () => {
  data = await testData();
  jest.mocked(openData).mockResolvedValue(data);
  const deck = await data.library.createDeck("Fiiller");
  deckId = deck.ok ? deck.id : "";
  await data.library.createCard(deckId, { front: "go", meanings: [{ tr: "gitmek" }] });
});

async function paste(text: string) {
  await renderRouter(APP, { initialUrl: `/deck/${deckId}` });
  await fireEvent.press(await screen.findByText("Toplu ekle"));
  await fireEvent.changeText(await screen.findByLabelText("Kartlar"), text);
}

describe("bulk add", () => {
  it("previews errors and repeats and adds only new cards", async () => {
    await paste("go; gitmek\nrun; koşmak, akmak\n; x\nrun; akmak");
    expect(await screen.findByText("1 kart eklenecek · 1 satır hatalı · 2 kart zaten var")).toBeOnTheScreen();
    expect(screen.getByText("3. satır: önyüz yok")).toBeOnTheScreen();
    expect(screen.getByText("go · Fiiller destesinde")).toBeOnTheScreen();
    expect(screen.getByText("run · 2. satırla aynı")).toBeOnTheScreen();

    await fireEvent.press(screen.getByText("1 kartı ekle"));
    await waitFor(async () => expect((await data.library.cards(deckId)).map((c) => c.front).sort()).toEqual(["go", "run"]));
    const run = (await data.library.cards(deckId)).find((c) => c.front === "run");
    expect(run?.meanings.map((m) => m.tr)).toEqual(["koşmak", "akmak"]);
  });

  it("reads tab separated columns", async () => {
    await paste("see\tgörmek");
    expect(await screen.findByText("1 kart eklenecek")).toBeOnTheScreen();
  });
});
