import { UNLIMITED } from "@dilkart/core";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Appearance } from "react-native";

import { openData } from "@/services/openData";
import { savedScheme } from "@/services/prefs";

import { testData } from "./testData";

jest.mock("@/services/openData", () => ({ openData: jest.fn() }));

const APP = "./src/app";
let data: Awaited<ReturnType<typeof testData>>;

beforeEach(async () => {
  data = await testData();
  jest.mocked(openData).mockResolvedValue(data);
});

describe("settings", () => {
  it("shows the defaults", async () => {
    await renderRouter(APP, { initialUrl: "/settings" });
    expect(await screen.findByText("20")).toBeOnTheScreen();
    expect(screen.getByText("200")).toBeOnTheScreen();
    expect(screen.getByText("04:00")).toBeOnTheScreen();
    expect(screen.getByText("ABD")).toBeOnTheScreen();
  });

  it("saves a picked value and shows it", async () => {
    await renderRouter(APP, { initialUrl: "/settings" });
    await fireEvent.press(await screen.findByText("Günlük yeni kart"));
    await fireEvent.press(await screen.findByText("30"));

    await waitFor(() => expect(screen.queryByText("50")).toBeNull());
    expect(await screen.findByText("30")).toBeOnTheScreen();
    expect((await data.settings.get()).newPerDay).toBe(30);
  });

  it("labels unlimited reviews", async () => {
    await data.settings.set({ reviewsPerDay: UNLIMITED });
    await renderRouter(APP, { initialUrl: "/settings" });
    expect(await screen.findByText("Sınırsız")).toBeOnTheScreen();
  });

  it("hides failed changes when there are none", async () => {
    await renderRouter(APP, { initialUrl: "/settings" });
    await screen.findByText("Günlük yeni kart");
    expect(screen.queryByText(/Gönderilemeyen/)).toBeNull();
  });

  it("shows the failed change count", async () => {
    await data.library.createDeck("Fiiller");
    const [op] = await data.store.pending(1);
    if (op === undefined) {
      throw new Error("setup failed");
    }
    await data.store.fail(op.seq, "22P02 invalid input");

    await renderRouter(APP, { initialUrl: "/settings" });
    expect(await screen.findByText("Gönderilemeyen değişiklik: 1")).toBeOnTheScreen();
  });

  it("switches to dark appearance and remembers it", async () => {
    const apply = jest.spyOn(Appearance, "setColorScheme");
    await renderRouter(APP, { initialUrl: "/settings" });
    await fireEvent(await screen.findByLabelText("Koyu görünüm"), "valueChange", true);

    expect(apply).toHaveBeenCalledWith("dark");
    expect(savedScheme()).toBe("dark");
  });
});
