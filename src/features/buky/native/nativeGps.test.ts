import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ consent: vi.fn(), addWatcher: vi.fn(), removeWatcher: vi.fn() }));
vi.mock("@capacitor/core", () => ({ registerPlugin: () => ({ addWatcher: mocks.addWatcher, removeWatcher: mocks.removeWatcher }) }));
vi.mock("../training/locationDisclosure", () => ({ requestLocationDisclosure: mocks.consent }));
import { nativeGpsSource } from "./nativeGps";
describe("GPS nativo", () => {
  it("não chama o plugin quando a divulgação é recusada", async () => {
    mocks.consent.mockResolvedValue(false);
    const onError = vi.fn();
    await nativeGpsSource.start(vi.fn(), onError);
    expect(onError).toHaveBeenCalledWith("permission_denied");
    expect(mocks.addWatcher).not.toHaveBeenCalled();
  });
  it("solicita permissão ao plugin depois do aceite", async () => {
    mocks.consent.mockResolvedValue(true); mocks.addWatcher.mockResolvedValue("watcher");
    const stop = await nativeGpsSource.start(vi.fn(), vi.fn());
    expect(mocks.addWatcher).toHaveBeenCalledWith(expect.objectContaining({ requestPermissions: true }), expect.any(Function));
    await stop(); expect(mocks.removeWatcher).toHaveBeenCalledWith({ id: "watcher" });
  });
});
