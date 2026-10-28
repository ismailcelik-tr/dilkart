import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";
import { Linking } from "react-native";

import { openData } from "@/services/openData";
import { refreshReminders } from "@/services/reminders";

import { fake, Permission } from "./fakeNotifications";
import { testData } from "./testData";

jest.mock("@/services/openData", () => ({ openData: jest.fn() }));

// The SwiftUI wheel needs native code; a press picks 07:45.
jest.mock("@/ui/TimePicker", () => {
  const { createElement } = require("react");
  const { Pressable } = require("react-native");
  return {
    TimePicker: ({ onChange }: { onChange: (minute: number) => void }) =>
      createElement(Pressable, { testID: "time-picker", onPress: () => onChange(7 * 60 + 45) }),
  };
});

const APP = "./src/app";
const MIN_PLANNED = 6;
let data: Awaited<ReturnType<typeof testData>>;

beforeEach(async () => {
  data = await testData();
  jest.mocked(openData).mockResolvedValue(data);
});

describe("reminders", () => {
  it("asks once on the home screen and plans the week", async () => {
    await renderRouter(APP, { initialUrl: "/" });
    await waitFor(() => expect(fake.scheduled.size).toBeGreaterThanOrEqual(MIN_PLANNED));
    expect(fake.asked).toBe(1);
    expect([...fake.scheduled.values()].every((r) => r.at.getHours() === 20)).toBe(true);
  });

  it("does not ask again once denied and plans nothing", async () => {
    fake.permission = Permission.Denied;
    await renderRouter(APP, { initialUrl: "/" });
    await screen.findByText("Henüz deste yok");
    await refreshReminders(data.stats); // queued after the home screen's ask
    expect(fake.asked).toBe(0);
    expect(fake.scheduled.size).toBe(0);
  });

  it("clears every reminder when turned off", async () => {
    fake.permission = Permission.Granted;
    await renderRouter(APP, { initialUrl: "/settings" });
    await waitFor(() => expect(fake.scheduled.size).toBeGreaterThanOrEqual(MIN_PLANNED));
    await fireEvent.press(await screen.findByText("Hatırlatma"));
    await fireEvent.press(await screen.findByText("Kapalı"));

    await waitFor(() => expect(fake.scheduled.size).toBe(0));
    expect(await screen.findByText("Kapalı")).toBeOnTheScreen();
  });

  it("moves reminders to the new hour", async () => {
    fake.permission = Permission.Granted;
    await renderRouter(APP, { initialUrl: "/settings" });
    expect(await screen.findByText("20:00")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Hatırlatma"));
    await fireEvent.press(await screen.findByText("09:00"));

    await waitFor(() => {
      const hours = [...fake.scheduled.values()].map((r) => r.at.getHours());
      expect(hours.length).toBeGreaterThanOrEqual(MIN_PLANNED);
      expect(hours.every((h) => h === 9)).toBe(true);
    });
    expect(await screen.findByText("09:00")).toBeOnTheScreen();
  });

  it("takes a custom time from the wheel", async () => {
    fake.permission = Permission.Granted;
    await renderRouter(APP, { initialUrl: "/settings/reminder" });
    await fireEvent.press(await screen.findByText("Özel…"));
    await fireEvent.press(screen.getByTestId("time-picker"));
    await fireEvent.press(screen.getByText("Kaydet"));

    await waitFor(() => {
      const times = [...fake.scheduled.values()].map((r) => [r.at.getHours(), r.at.getMinutes()]);
      expect(times.length).toBeGreaterThanOrEqual(MIN_PLANNED);
      expect(times.every(([h, m]) => h === 7 && m === 45)).toBe(true);
    });
  });

  it("sends to iOS Settings when permission is denied", async () => {
    fake.permission = Permission.Denied;
    const open = jest.spyOn(Linking, "openSettings").mockResolvedValue();
    await renderRouter(APP, { initialUrl: "/settings" });
    await fireEvent.press(await screen.findByText("Kapalı · iOS Ayarları'ndan izin ver"));
    expect(open).toHaveBeenCalled();
  });
});
