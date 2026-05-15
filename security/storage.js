(function(global) {
  "use strict";

  const STORAGE_PREFIX = "secure:v1:";
  const SALT_KEY = "__secureStorageSalt";
  const PASSPHRASE_SCOPE = "bola-de-nieve:financial-storage";

  function ensureCrypto() {
    if (!global.CryptoJS?.AES) {
      throw new Error("CryptoJS no esta disponible para cifrar LocalStorage.");
    }
  }

  function getSalt() {
    let salt = global.localStorage.getItem(SALT_KEY);
    if (salt) return salt;

    const bytes = new Uint8Array(16);
    global.crypto?.getRandomValues?.(bytes);
    salt = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("") || String(Date.now());
    global.localStorage.setItem(SALT_KEY, salt);
    return salt;
  }

  function getPassphrase() {
    const origin = global.location?.origin || "local-origin";
    return `${PASSPHRASE_SCOPE}:${origin}:${getSalt()}`;
  }

  function encryptData(data) {
    ensureCrypto();
    const payload = JSON.stringify(data);
    const encrypted = global.CryptoJS.AES.encrypt(payload, getPassphrase()).toString();
    return `${STORAGE_PREFIX}${encrypted}`;
  }

  function decryptData(data) {
    ensureCrypto();
    if (typeof data !== "string" || !data.startsWith(STORAGE_PREFIX)) {
      throw new Error("Formato de almacenamiento seguro invalido.");
    }

    const encrypted = data.slice(STORAGE_PREFIX.length);
    const bytes = global.CryptoJS.AES.decrypt(encrypted, getPassphrase());
    const decrypted = bytes.toString(global.CryptoJS.enc.Utf8);
    if (!decrypted) {
      throw new Error("No fue posible descifrar los datos almacenados.");
    }
    return JSON.parse(decrypted);
  }

  function saveSecureStorage(key, value) {
    try {
      global.localStorage.setItem(key, encryptData(value));
      return true;
    } catch (error) {
      console.error(`Error guardando almacenamiento seguro para ${key}:`, error);
      return false;
    }
  }

  function loadSecureStorage(key) {
    const stored = global.localStorage.getItem(key);
    if (!stored) return null;

    try {
      if (stored.startsWith(STORAGE_PREFIX)) {
        return decryptData(stored);
      }

      const legacyValue = JSON.parse(stored);
      saveSecureStorage(key, legacyValue);
      return legacyValue;
    } catch (error) {
      console.warn(`Error leyendo almacenamiento seguro para ${key}:`, error);
      return null;
    }
  }

  global.encryptData = encryptData;
  global.decryptData = decryptData;
  global.saveSecureStorage = saveSecureStorage;
  global.loadSecureStorage = loadSecureStorage;
  global.SecurityStorage = {
    encryptData,
    decryptData,
    saveSecureStorage,
    loadSecureStorage
  };
})(window);
