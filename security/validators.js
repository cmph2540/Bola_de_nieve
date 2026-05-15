(function(global) {
  "use strict";

  const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

  function toNumber(value) {
    if (typeof value === "number") return value;
    if (typeof value !== "string") return Number.NaN;

    let normalized = value
      .trim()
      .replace(/\$/g, "")
      .replace(/\s/g, "");

    if (normalized.includes(".") && normalized.includes(",")) {
      normalized = normalized.replace(/\./g, "").replace(/,/g, ".");
    } else if (normalized.includes(",")) {
      normalized = normalized.replace(/,/g, ".");
    } else {
      const dotParts = normalized.split(".");
      if (dotParts.length > 2 || (dotParts.length === 2 && dotParts[1].length === 3 && dotParts[0].length > 1)) {
        normalized = normalized.replace(/\./g, "");
      }
    }

    if (!normalized || !/^-?\d+(\.\d+)?$/.test(normalized)) {
      return Number.NaN;
    }
    return Number(normalized);
  }

  function buildResult(valid, value, message) {
    return { valid, value, message: valid ? "" : message };
  }

  function validateCurrency(value, options = {}) {
    const min = options.allowZero === false ? Number.MIN_VALUE : 0;
    const number = toNumber(value);
    if (!Number.isFinite(number)) {
      return buildResult(false, null, "El valor monetario debe ser un numero finito.");
    }
    if (number < min) {
      return buildResult(false, null, options.allowZero === false
        ? "El valor monetario debe ser mayor que cero."
        : "El valor monetario no puede ser negativo.");
    }
    return buildResult(true, number, "");
  }

  function validateInterest(value) {
    const number = toNumber(value);
    if (!Number.isFinite(number)) {
      return buildResult(false, null, "El interes debe ser un numero finito.");
    }
    if (number < 0 || number > 99) {
      return buildResult(false, null, "El interes debe estar entre 0 y 99.");
    }
    return buildResult(true, number, "");
  }

  function validateUVR(value) {
    const number = toNumber(value);
    if (!Number.isFinite(number)) {
      return buildResult(false, null, "La UVR debe ser un numero finito.");
    }
    if (number <= 0) {
      return buildResult(false, null, "La UVR debe ser positiva.");
    }
    return buildResult(true, number, "");
  }

  function validateDate(value) {
    if (typeof value !== "string" || !ISO_DATE_RE.test(value)) {
      return buildResult(false, null, "La fecha debe tener formato YYYY-MM-DD.");
    }

    const [year, month, day] = value.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    const valid = date.getFullYear() === year
      && date.getMonth() === month - 1
      && date.getDate() === day;

    return valid
      ? buildResult(true, value, "")
      : buildResult(false, null, "La fecha no es valida.");
  }

  global.validateCurrency = validateCurrency;
  global.validateInterest = validateInterest;
  global.validateUVR = validateUVR;
  global.validateDate = validateDate;
  global.SecurityValidators = {
    validateCurrency,
    validateInterest,
    validateUVR,
    validateDate
  };
})(window);
