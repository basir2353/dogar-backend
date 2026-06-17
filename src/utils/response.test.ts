import { describe, expect, it } from "vitest";
import { fail, ok } from "./response";

describe("response envelope", () => {
  it("ok wraps data and optional meta", () => {
    expect(ok({ a: 1 })).toEqual({ success: true, data: { a: 1 } });
    expect(ok({ a: 1 }, { page: 2 })).toEqual({ success: true, data: { a: 1 }, meta: { page: 2 } });
  });

  it("fail returns stable error shape", () => {
    expect(fail("X", "msg")).toEqual({ success: false, error: { code: "X", message: "msg" } });
  });
});
