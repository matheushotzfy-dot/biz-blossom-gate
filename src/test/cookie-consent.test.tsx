import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CookieConsent, openCookieSettings } from "@/components/CookieConsent";

const KEY = "venxpay-cookie-consent-v1";
const show = () => render(<MemoryRouter><CookieConsent /></MemoryRouter>);

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("aviso de cookies", () => {
  it("aparece para quem ainda não escolheu, depois que a página pinta", async () => {
    show();
    expect(screen.queryByText("Sua privacidade importa")).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(screen.getByText("Sua privacidade importa")).toBeTruthy();
  });

  it("não aparece de novo para quem já escolheu", async () => {
    localStorage.setItem(KEY, JSON.stringify({ necessary: true, analytics: false, marketing: false, timestamp: "x", version: 1 }));
    show();
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    expect(screen.queryByText("Sua privacidade importa")).toBeNull();
  });

  it("recusar grava só os necessários, com data, e avisa a página", async () => {
    const heard = vi.fn();
    window.addEventListener("venxpay:cookie-consent", heard);
    show();
    await act(async () => { await vi.advanceTimersByTimeAsync(700); });
    fireEvent.click(screen.getByRole("button", { name: "Recusar todos" }));
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    expect(saved).toMatchObject({ necessary: true, analytics: false, marketing: false, version: 1 });
    expect(typeof saved.timestamp).toBe("string");
    expect(heard).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Sua privacidade importa")).toBeNull();
    window.removeEventListener("venxpay:cookie-consent", heard);
  });

  it("o rodapé reabre as preferências; Esc volta ao aviso compacto e salvar guarda a escolha", async () => {
    localStorage.setItem(KEY, JSON.stringify({ necessary: true, analytics: false, marketing: false, timestamp: "x", version: 1 }));
    show();
    act(() => openCookieSettings());
    const dialog = screen.getByRole("dialog", { name: "Preferências de cookies" });
    expect(document.activeElement).toBe(dialog);
    fireEvent.click(screen.getByRole("button", { name: /Análise e desempenho/ }));
    fireEvent.click(screen.getByRole("button", { name: /Salvar preferências/ }));
    expect(JSON.parse(localStorage.getItem(KEY) ?? "{}")).toMatchObject({ analytics: true, marketing: false });

    act(() => openCookieSettings());
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByText("Sua privacidade importa")).toBeTruthy();
  });
});
