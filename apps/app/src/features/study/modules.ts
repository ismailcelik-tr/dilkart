import { Module, Rating } from "@dilkart/core";

export const MODULE_NAMES: Record<Module, string> = {
  [Module.Recall]: "Anlam hatırlama",
  [Module.Reverse]: "Ters yön",
  [Module.Typing]: "Yazarak",
  [Module.Listening]: "Dinleyip yazma",
  [Module.Match]: "Eşleştirme",
};

export const MODULES = Object.values(Module).filter((m): m is Module => typeof m === "number");

export const RATING_NAMES: Record<Rating, string> = {
  [Rating.Again]: "Tekrar",
  [Rating.Hard]: "Zor",
  [Rating.Good]: "İyi",
  [Rating.Easy]: "Kolay",
};

export const RATINGS = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];
