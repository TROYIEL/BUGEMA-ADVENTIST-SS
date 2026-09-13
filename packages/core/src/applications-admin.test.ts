import "dotenv/config";

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ApplicationStatus } from "@bass/db/enums";

import { changeNeedsDecision, csvCell, isDecision } from "./applications-admin";

describe("decisions", () => {
  it("treats accept, conditional and reject as decisions", () => {
    assert.equal(isDecision(ApplicationStatus.ACCEPTED), true);
    assert.equal(isDecision(ApplicationStatus.CONDITIONALLY_ACCEPTED), true);
    assert.equal(isDecision(ApplicationStatus.REJECTED), true);
    assert.equal(isDecision(ApplicationStatus.SHORTLISTED), false);
    assert.equal(isDecision(ApplicationStatus.WITHDRAWN), false);
  });

  it("requires the decide permission both into and out of an outcome", () => {
    assert.equal(changeNeedsDecision(ApplicationStatus.UNDER_REVIEW, ApplicationStatus.ACCEPTED), true);
    assert.equal(changeNeedsDecision(ApplicationStatus.ACCEPTED, ApplicationStatus.UNDER_REVIEW), true);
    assert.equal(changeNeedsDecision(ApplicationStatus.REJECTED, ApplicationStatus.ACCEPTED), true);
    assert.equal(changeNeedsDecision(ApplicationStatus.SUBMITTED, ApplicationStatus.UNDER_REVIEW), false);
    assert.equal(changeNeedsDecision(ApplicationStatus.SHORTLISTED, ApplicationStatus.WITHDRAWN), false);
  });
});

describe("csv cells", () => {
  it("leaves plain values alone and blanks null", () => {
    assert.equal(csvCell("Amina"), "Amina");
    assert.equal(csvCell(12), "12");
    assert.equal(csvCell(null), "");
    assert.equal(csvCell(undefined), "");
  });

  it("quotes commas, quotes and newlines", () => {
    assert.equal(csvCell("Nakato, Amina"), '"Nakato, Amina"');
    assert.equal(csvCell('say "hi"'), '"say ""hi"""');
    assert.equal(csvCell("line one\nline two"), '"line one\nline two"');
  });

  it("neutralises spreadsheet formulas", () => {
    assert.equal(csvCell("=HYPERLINK(\"http://evil\")"), "\"'=HYPERLINK(\"\"http://evil\"\")\"");
    assert.equal(csvCell("+256 700 000 001"), "'+256 700 000 001");
    assert.equal(csvCell("-1"), "'-1");
    assert.equal(csvCell("@import"), "'@import");
  });

  it("writes dates as ISO strings", () => {
    assert.equal(csvCell(new Date("2026-09-13T10:00:00.000Z")), "2026-09-13T10:00:00.000Z");
  });
});
