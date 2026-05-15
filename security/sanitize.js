(function(global) {
  "use strict";

  const SCRIPT_BLOCK_RE = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
  const TAG_RE = /<\/?[^>]+>/g;
  const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;
  const HTML_ENTITIES = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  function sanitizeInput(value) {
    if (value === null || value === undefined) return "";
    return String(value)
      .replace(SCRIPT_BLOCK_RE, "")
      .replace(TAG_RE, "")
      .replace(CONTROL_RE, "")
      .trim();
  }

  function sanitizeObject(value) {
    if (typeof value === "string") return sanitizeInput(value);
    if (Array.isArray(value)) return value.map((item) => sanitizeObject(item));
    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => [sanitizeInput(key), sanitizeObject(item)])
      );
    }
    return value;
  }

  function sanitizeForRender(value) {
    return sanitizeInput(value).replace(/[&<>"']/g, (char) => HTML_ENTITIES[char]);
  }

  function sanitizeAttribute(value) {
    return sanitizeForRender(value);
  }

  function sanitizeFormElement(element) {
    if (!element || !("value" in element)) return;
    element.value = sanitizeInput(element.value);
  }

  global.sanitizeInput = sanitizeInput;
  global.SecuritySanitize = {
    sanitizeInput,
    sanitizeObject,
    sanitizeForRender,
    sanitizeAttribute,
    sanitizeFormElement
  };
})(window);
