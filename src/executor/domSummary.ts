// src/executor/domSummary.ts
import { Page } from "playwright";
import { logger } from "../utils/logger";

export interface DomClickable {
  tag: string;
  role: string | null;
  text: string | null;
  ariaLabel: string | null;
  kind: "button" | "link" | "menuItem" | "other";
}

export interface DomInput {
  tag: string;
  role: string | null;
  placeholder: string | null;
  ariaLabel: string | null;
  kind: "textbox" | "textarea" | "contentEditable" | "other";
}

export interface DomContainer {
  tag: string;
  role: string | null;
  ariaLabel: string | null;
  className: string | null;
  text: string | null;
}

export interface DomSummary {
  url: string;
  title: string | null;
  clickables: DomClickable[];
  inputs: DomInput[];
  containers: DomContainer[];
}

export async function getDomSummary(page: Page): Promise<DomSummary> {
  const result = await page.evaluate(() => {
    const clickables: DomClickable[] = [];
    const inputs: DomInput[] = [];
    const containers: DomContainer[] = [];

    const isVisible = (el: Element) => {
      const style = window.getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        style.opacity !== "0" &&
        rect.width > 0 &&
        rect.height > 0
      );
    };

    const getCleanText = (el: Element, maxLength = 10000) => {
      const text = el.textContent || "";
      return text.replace(/\s+/g, " ").trim().slice(0, maxLength);
    };

    const getRole = (el: Element) => el.getAttribute("role");
    const getAriaLabel = (el: Element) => el.getAttribute("aria-label");

    const getClickableKind = (
      tag: string,
      role: string | null,
      _el: Element
    ): "button" | "link" | "menuItem" | "other" => {
      if (tag === "button" || role === "button") return "button";
      if (tag === "a" || role === "link") return "link";
      if (role === "menuitem") return "menuItem";
      return "other";
    };

    const getInputKind = (
      tag: string,
      role: string | null,
      el: Element
    ): "textbox" | "textarea" | "contentEditable" | "other" => {
      if (tag === "textarea") return "textarea";
      if (el.getAttribute("contenteditable") === "true")
        return "contentEditable";
      if (role === "textbox") return "textbox";
      return "other";
    };

    const allElements = document.querySelectorAll("*");
    let clickableCount = 0;
    let inputCount = 0;
    const MAX_CLICKABLES = 10000;
    const MAX_INPUTS = 10000;
    const MAX_CONTAINERS = 300;

    const STRUCTURAL_ROLES = new Set([
      "table",
      "grid",
      "treegrid",
      "list",
      "listbox",
      "region",
      "main",
      "form",
      "dialog",
      "tabpanel",
      "group",
    ]);

    const STRUCTURAL_TAGS = new Set([
      "table",
      "thead",
      "tbody",
      "tfoot",
      "section",
      "main",
      "article",
      "aside",
      "nav",
    ]);

    const CLASS_HINT_REGEX =
      /(table|grid|list|board|collection|database|results|items|columns|rows|content|container|panel|viewport)/i;

    for (const el of Array.from(allElements)) {
      if (
        clickableCount >= MAX_CLICKABLES &&
        inputCount >= MAX_INPUTS &&
        containers.length >= MAX_CONTAINERS
      ) {
        break;
      }

      if (!isVisible(el)) continue;

      const tag = el.tagName.toLowerCase();
      const role = getRole(el);
      const ariaLabel = getAriaLabel(el);
      const className = (el as HTMLElement).className || "";

      // ---------- Inputs ----------
      if (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        el.getAttribute("contenteditable") === "true" ||
        role === "textbox" ||
        role === "searchbox" ||
        role === "combobox"
      ) {
        if (inputCount < MAX_INPUTS) {
          const placeholder = el.getAttribute("placeholder");

          inputs.push({
            tag,
            role,
            placeholder,
            ariaLabel,
            kind: getInputKind(tag, role, el),
          });
          inputCount++;
        }
        continue;
      }

      // ---------- Clickables ----------
      if (
        tag === "button" ||
        tag === "a" ||
        role === "button" ||
        role === "link" ||
        role === "menuitem" ||
        role === "option" ||
        role === "tab" ||
        el.hasAttribute("onclick") ||
        tag === "summary"
      ) {
        if (clickableCount < MAX_CLICKABLES) {
          const text = getCleanText(el);

          if (!text && !ariaLabel) {
          } else {
            clickables.push({
              tag,
              role,
              text,
              ariaLabel,
              kind: getClickableKind(tag, role, el),
            });
            clickableCount++;
          }
        }
      }

      // ---------- Containers (generic, loose) ----------
      if (containers.length < MAX_CONTAINERS) {
        const rect = el.getBoundingClientRect();
        const area = rect.width * rect.height;

        if (area > 5000) {
          const roleLower = (role || "").toLowerCase();
          const looksStructural =
            STRUCTURAL_TAGS.has(tag) || STRUCTURAL_ROLES.has(roleLower);
          const classLooksStructural =
            !!className && CLASS_HINT_REGEX.test(className);

          if (looksStructural || classLooksStructural) {
            containers.push({
              tag,
              role,
              ariaLabel,
              className: className || null,
              text: getCleanText(el, 2000),
            });
          }
        }
      }
    }

    return {
      url: window.location.href,
      title: document.title,
      clickables,
      inputs,
      containers,
    };
  });

  return result;
}
