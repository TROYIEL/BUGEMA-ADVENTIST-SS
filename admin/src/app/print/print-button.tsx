"use client";

/** Opens the browser's print dialog; hidden on paper by `print:hidden`. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-full bg-navy-800 px-5 py-2 text-sm font-semibold text-white hover:bg-navy-900 print:hidden"
    >
      Print or save as PDF
    </button>
  );
}
