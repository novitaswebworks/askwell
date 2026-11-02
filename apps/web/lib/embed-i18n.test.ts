import { DEFAULT_WIDGET_CONFIG } from "@askwell/shared";
import { describe, expect, it } from "vitest";
import { LANGS, getStrings, localizeConfigText, resolveLang, type Strings } from "./embed-i18n";

describe("resolveLang", () => {
  it("reads the language part and ignores case", () => {
    expect(resolveLang("es-MX")).toBe("es");
    expect(resolveLang("HI_IN")).toBe("hi");
    expect(resolveLang("fr")).toBe("fr");
  });
  it("falls back to English", () => {
    for (const bad of [null, undefined, "", "ja", "zz-ZZ", "<x>"]) expect(resolveLang(bad)).toBe("en");
  });
});

describe("labels", () => {
  it("has every label in every language, none left empty", () => {
    const keys = Object.keys(getStrings("en")) as (keyof Strings)[];
    for (const lang of LANGS) {
      const t = getStrings(lang);
      expect(Object.keys(t).sort()).toEqual([...keys].sort());
      for (const key of keys) {
        const value = t[key];
        expect(Array.isArray(value) ? value.every(Boolean) : Boolean(value)).toBe(true);
      }
    }
  });
});

describe("localizeConfigText", () => {
  const { headerText, welcomeMessage, starterQuestions } = DEFAULT_WIDGET_CONFIG;
  it("translates untouched defaults", () => {
    const out = localizeConfigText({ headerText, welcomeMessage, starterQuestions }, getStrings("es"));
    expect(out.headerText).toBe(getStrings("es").defaultHeader);
    expect(out.welcomeMessage).toBe(getStrings("es").defaultWelcome);
    expect(out.starterQuestions).toEqual(getStrings("es").defaultStarters);
  });
  it("never translates the owner's own words", () => {
    const own = { headerText: "Ask Sam", welcomeMessage: "Hi, I'm Sam.", starterQuestions: ["Prices?"] };
    expect(localizeConfigText(own, getStrings("de"))).toEqual(own);
  });
  it("leaves English alone", () => {
    expect(localizeConfigText({ headerText, welcomeMessage, starterQuestions }, getStrings("en"))).toEqual({
      headerText,
      welcomeMessage,
      starterQuestions,
    });
  });
});
