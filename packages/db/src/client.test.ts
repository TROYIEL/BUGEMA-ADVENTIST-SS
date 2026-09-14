import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { pinSslMode } from "./client";

describe("pinSslMode", () => {
  it("upgrades sslmode=require to verify-full wherever it sits in the query", () => {
    assert.equal(pinSslMode("postgresql://u:p@h/db?sslmode=require"), "postgresql://u:p@h/db?sslmode=verify-full");
    assert.equal(
      pinSslMode("postgresql://u:p@h/db?channel_binding=require&sslmode=require"),
      "postgresql://u:p@h/db?channel_binding=require&sslmode=verify-full",
    );
    assert.equal(pinSslMode("postgresql://u:p@h/db?sslmode=require&application_name=x"), "postgresql://u:p@h/db?sslmode=verify-full&application_name=x");
  });

  it("leaves every other string alone", () => {
    for (const url of ["postgresql://u:p@localhost:5432/db?schema=public", "postgresql://u:p@h/db?sslmode=disable", "postgresql://u:p@h/db?sslmode=verify-full", "postgresql://u:p@h/db?uselibpqcompat=true&sslmode=require&x=1"]) {
      assert.equal(pinSslMode(url), url.includes("uselibpqcompat") ? url.replace("sslmode=require", "sslmode=verify-full") : url);
    }
  });
});
