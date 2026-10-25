import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// jsdom tidak mengimplementasikan scrollTo pada elemen (dipakai GanttChart untuk "Hari ini").
if (typeof Element.prototype.scrollTo !== "function") {
  Element.prototype.scrollTo = function scrollTo() {
    /* no-op di lingkungan uji */
  };
}

afterEach(() => {
  cleanup();
});
