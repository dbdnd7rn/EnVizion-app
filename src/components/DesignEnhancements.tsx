import { useEffect } from "react";
import { Platform } from "react-native";

/** Progressive web polish; shared RN styles remain the native source of truth. */
export function DesignEnhancements() {
  useEffect(() => {
    if (Platform.OS !== "web" || typeof document === "undefined") return;
    const sheet = document.createElement("style");
    sheet.dataset.envizionDesign = "glass";
    sheet.textContent = `
      :root { color-scheme: light; }
      [role="button"], [role="tab"], input, textarea {
        transition: background-color 160ms ease, border-color 160ms ease,
          box-shadow 160ms ease, opacity 160ms ease;
      }
      [role="button"]:focus-visible, [role="tab"]:focus-visible,
      a:focus-visible, input:focus-visible, textarea:focus-visible {
        outline: 3px solid #70338f; outline-offset: 3px;
      }
      input:focus, textarea:focus { border-color: #9a70b3 !important; }
      textarea { resize: vertical; }
      input, textarea { caret-color: #70338f; }
      @media (hover: hover) {
        [data-design-card="interactive"]:hover {
          border-color: #cbb3df !important;
          box-shadow: 0 10px 30px rgba(69,35,91,.09) !important;
        }
      }
      @media (prefers-reduced-motion: no-preference) {
        [data-design-page="true"] { animation: envizion-enter 260ms ease-out both; }
        @keyframes envizion-enter { from { opacity: .5; } to { opacity: 1; } }
      }
      @media (prefers-reduced-motion: reduce) {
        [role="button"], [role="tab"], input, textarea { transition: none !important; }
      }
      @media (prefers-reduced-transparency: reduce) {
        [data-design-card] { backdrop-filter: none !important; background-color: #fff !important; }
      }
    `;
    document.head.appendChild(sheet);
    return () => { sheet.remove(); };
  }, []);
  return null;
}
