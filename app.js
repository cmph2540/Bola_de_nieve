(function() {
      "use strict";

      /* ========= CONSTANTES ========= */
      const STORAGE_KEYS = {
        OBLIGACIONES: 'obligaciones',
        OBLIGACIONES_CERRADAS: 'obligacionesCerradas',
        ENTIDADES: 'entidadesListado',
        LOGROS: 'logrosDesbloqueados'
      };

      const LOGROS_CONFIG = [
        { id: 'primer_abono', nombre: '🥉 Primer paso', descripcion: 'Realiza tu primer abono', icono: '🎯' },
        { id: 'ahorrador_100k', nombre: '💰 Ahorrador', descripcion: 'Ahorra $100.000', icono: '💵' },
        { id: 'ahorrador_500k', nombre: '💪 Intermedio', descripcion: 'Ahorra $500.000', icono: '💰' },
        { id: 'ahorrador_1m', nombre: '💎 Experto', descripcion: 'Ahorra $1.000.000', icono: '💎' },
        { id: 'deuda_cero', nombre: '🏆 Libertad', descripcion: 'Liquida todas', icono: '🦅' },
        { id: 'acelerador', nombre: '⚡ Acelerador', descripcion: 'Evita 12 cuotas', icono: '🚀' }
      ];

      // Base de datos de ofertas por tipo de crédito
      const OFERTAS_DB = {
         consumo: [
          { entidad: 'Bancolombia', tasa: 21.5, tipo: 'Consumo', requisitos: 'Libranza o nómina', icono: '🏦' },
          { entidad: 'BBVA', tasa: 20.8, tipo: 'Consumo', requisitos: 'Crédito rotativo', icono: '🇪🇸' },
          { entidad: 'Banco de Bogotá', tasa: 22.3, tipo: 'Consumo', requisitos: 'Cliente preferencial', icono: '🏛️' },
          { entidad: 'Davivienda', tasa: 23.1, tipo: 'Consumo', requisitos: 'Mixto', icono: '🏠' },
          { entidad: 'Lulo Bank', tasa: 19.9, tipo: 'Consumo', requisitos: '100% digital', icono: '📱' }
        ],
        tarjeta: [
          { entidad: 'Nu', tasa: 28.5, tipo: 'Tarjeta', requisitos: 'Sin cuota de manejo', icono: '💜' },
          { entidad: 'RappiCard', tasa: 29.9, tipo: 'Tarjeta', requisitos: 'Puntos Rappi', icono: '🦸' },
          { entidad: 'Lulo Bank', tasa: 26.8, tipo: 'Tarjeta', requisitos: 'Cashback', icono: '📱' },
          { entidad: 'Bancolombia', tasa: 31.2, tipo: 'Tarjeta', requisitos: 'World Member', icono: '🏦' }
        ],
        vivienda: [
          { entidad: 'Banco de Bogotá', tasa: 11.5, tipo: 'Vivienda', requisitos: 'Tasa fija', icono: '🏛️' },
          { entidad: 'Davivienda', tasa: 10.8, tipo: 'Vivienda', requisitos: 'Tasa mixta', icono: '🏠' },
          { entidad: 'BBVA', tasa: 11.2, tipo: 'Vivienda', requisitos: 'UVR + spread', icono: '🇪🇸' }
        ],
        vehiculo: [
          { entidad: 'Banco de Occidente', tasa: 16.5, tipo: 'Vehículo', requisitos: 'Hasta 84 meses', icono: '🚗' },
          { entidad: 'Davivienda', tasa: 17.2, tipo: 'Vehículo', requisitos: 'Crédito directo', icono: '🏠' }
        ],
        libre_inversion: [
          { entidad: 'Lulo Bank', tasa: 18.5, tipo: 'Libre inversión', requisitos: 'Aprobación 24h', icono: '📱' },
          { entidad: 'BBVA', tasa: 19.8, tipo: 'Libre inversión', requisitos: 'Sin codeudor', icono: '🇪🇸' }
        ]
      };

      const UVR_CONFIG = {
        DEFAULT_VALUE: 385.62,
        DEFAULT_INFLATION_EA: 5.2,
        HARD_MIN_INFLATION: -2,
        HARD_MAX_INFLATION: 60,
        EXTREME_MIN_INFLATION: 0,
        EXTREME_MAX_INFLATION: 18,
        MAX_SIMULATION_MONTHS: 720,
        EPSILON_UVR: 1e-8,
        MIN_UVR_VALUE: 1,
        API_TIMEOUT_MS: 8000
      };

      const TIPOS_MOVIMIENTO = {
        PAGO_CUOTA: 'PAGO_CUOTA',
        ABONO_CAPITAL: 'ABONO_CAPITAL'
      };

      let uvrActual = UVR_CONFIG.DEFAULT_VALUE;
      let uvrFuenteActual = 'manual';
      let monedaSeleccionada = 'COP'; // COP o UVR
      let graficoProyeccionUVR = null;
      let obligacionEditandoId = null;
      let obligacionPendienteEliminarId = null;
      let ultimoAjusteDashboard = null;

      const EDITION_HISTORY_MAX_SALDO_VARIATION = 0.35;

      // Utilidades
      const fmtCOP = (v) => new Intl.NumberFormat('es-CO', { 
        style: 'currency', 
        currency: 'COP', 
        minimumFractionDigits: 0,
        maximumFractionDigits: 0 
      }).format(v || 0).replace(/\s/g, '');
      
      const fmtUVR = (v) => `${(Number(v) || 0).toFixed(2)} UVR`;
      const roundTo = (value, decimals = 8) => {
        const factor = Math.pow(10, decimals);
        return Math.round((Number(value) || 0) * factor) / factor;
      };
      const esNumeroFinito = (value) => Number.isFinite(Number(value));
      
      const fmtMonto = (v, moneda) => {
        if (moneda === 'UVR') {
          return v.toFixed(2) + ' UVR';
        }
        return fmtCOP(v);
      };

      const fmtPct = (v) => `${(v * 100).toFixed(1)}%`;
      const byId = (id) => document.getElementById(id);
      const hoyISO = () => new Date().toISOString().slice(0, 10);
      const parsePctToDec = (pct) => (Number(pct) || 0) / 100;
      const DAY_IN_MS = 24 * 60 * 60 * 1000;
      const parseFormattedNumber = (value) => Number(String(value || "")
        .replace(/\$/g, "")
        .replace(/\s/g, "")
        .replace(/\./g, "")
        .replace(/,/g, ".")
        .replace(/[^\d.-]/g, "")) || 0;
      const formatInputMiles = (input) => {
        if (!input) return;
        const digits = String(input.value || "").replace(/\D/g, "");
        if (!digits) {
          input.value = "";
          input.dataset.raw = "";
          return;
        }
        input.dataset.raw = digits;
        input.value = new Intl.NumberFormat("es-CO", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(Number(digits));
      };
      const getInputMoneyValue = (id) => {
        const input = byId(id);
        if (!input) return 0;
        return parseFormattedNumber(input.dataset.raw || input.value);
      };
      const formatDateDisplay = (value) => {
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return "--/--/----";
        const day = String(date.getDate()).padStart(2, "0");
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const year = date.getFullYear();
        return `${day}/${month}/${year}`;
      };
      const formatearDuracionMeses = (totalMeses) => {
        const meses = Math.max(0, Math.round(Number(totalMeses) || 0));
        if (meses <= 0) return '0 meses';
        const anos = Math.floor(meses / 12);
        const mesesRestantes = meses % 12;
        if (anos > 0 && mesesRestantes > 0) {
          return `${anos} ${anos === 1 ? 'año' : 'años'} y ${mesesRestantes} ${mesesRestantes === 1 ? 'mes' : 'meses'}`;
        }
        if (anos > 0) {
          return `${anos} ${anos === 1 ? 'año' : 'años'}`;
        }
        return `${mesesRestantes} ${mesesRestantes === 1 ? 'mes' : 'meses'}`;
      };
      const parseStoredDate = (value) => {
        if (!value) return null;
        if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
        if (typeof value === "string") {
          const normalized = value
            .normalize("NFKD")
            .replace(/\u00A0/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          const localeMatch = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:,?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(?:([ap])\.?\s*m\.?)?)?$/i);
          if (localeMatch) {
            const [, dayStr, monthStr, yearStr, hourStr = "0", minuteStr = "0", secondStr = "0", period = "a"] = localeMatch;
            let hour = Number(hourStr);
            const minute = Number(minuteStr);
            const second = Number(secondStr);
            const periodLower = String(period || "a").toLowerCase();
            if (periodLower === "p" && hour < 12) hour += 12;
            if (periodLower === "a" && hour === 12) hour = 0;
            const parsed = new Date(Number(yearStr), Number(monthStr) - 1, Number(dayStr), hour, minute, second);
            return Number.isNaN(parsed.getTime()) ? null : parsed;
          }
        }
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
      };
      const toIsoDate = (value, fallback = hoyISO()) => {
        const parsed = parseStoredDate(value);
        if (!parsed) return fallback;
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };
      const addMonthsIso = (isoDate, monthsToAdd) => {
        const base = parseStoredDate(isoDate) || new Date();
        const result = new Date(base.getFullYear(), base.getMonth() + monthsToAdd, base.getDate());
        return toIsoDate(result);
      };
      const diffDays = (startDate, endDate) => {
        const start = parseStoredDate(startDate);
        const end = parseStoredDate(endDate);
        if (!start || !end) return 0;
        return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      };
      const pushWarning = (warnings, message) => {
        if (warnings && message && !warnings.includes(message)) warnings.push(message);
      };
      const esCreditoUVR = (ob) => ob?.tipoCredito === 'vivienda' && ob?.moneda === 'UVR';

      // Estado global
      let entidadesListado = [];
      let obligaciones = [];
      let obligacionesCerradas = [];
      let logrosDesbloqueados = [];
      let ordenMetodo = 'snowball';
      let graficoInstance = null;
      let vistaGraficoActual = 'acumulado';

      /* ========= FUNCIONES PARA VIVIENDA Y UVR (TODAS TUS FUNCIONES ORIGINALES) ========= */
      function sanearInflacionPct(inflacionPct, warnings = []) {
        let valor = Number(inflacionPct);
        if (!Number.isFinite(valor)) {
          valor = UVR_CONFIG.DEFAULT_INFLATION_EA;
          pushWarning(warnings, `No indicaste inflacion esperada. Se uso ${UVR_CONFIG.DEFAULT_INFLATION_EA}%.`);
        }

        if (valor < UVR_CONFIG.HARD_MIN_INFLATION) {
          pushWarning(warnings, `La inflacion era menor a ${UVR_CONFIG.HARD_MIN_INFLATION}%. Se ajusto al minimo permitido.`);
          valor = UVR_CONFIG.HARD_MIN_INFLATION;
        }

        if (valor > UVR_CONFIG.HARD_MAX_INFLATION) {
          pushWarning(warnings, `La inflacion era mayor a ${UVR_CONFIG.HARD_MAX_INFLATION}%. Se ajusto al maximo permitido.`);
          valor = UVR_CONFIG.HARD_MAX_INFLATION;
        }

        if (valor < UVR_CONFIG.EXTREME_MIN_INFLATION || valor > UVR_CONFIG.EXTREME_MAX_INFLATION) {
          pushWarning(warnings, 'La inflacion ingresada es extrema. La proyeccion UVR puede diferir bastante del comportamiento real.');
        }

        return valor;
      }

      function sanearValorUvr(valor, warnings = [], fallback = uvrActual) {
        const parsed = Number(valor);
        if (!Number.isFinite(parsed) || parsed < UVR_CONFIG.MIN_UVR_VALUE) {
          pushWarning(warnings, `El valor UVR no era valido. Se uso ${fallback.toFixed(2)}.`);
          return fallback;
        }
        return parsed;
      }

      function calcularCuotaNivelada(saldo, em, meses) {
        const saldoNum = Number(saldo) || 0;
        const mesesNum = Math.max(0, Math.round(Number(meses) || 0));
        if (saldoNum <= 0 || mesesNum <= 0) return 0;
        if (Math.abs(em) < 1e-12) return saldoNum / mesesNum;
        return (saldoNum * em) / (1 - Math.pow(1 + em, -mesesNum));
      }

      function calcularCuotaFijaUVR(saldoUVR, tasaEARealDec, mesesRestantes) {
        return roundTo(calcularCuotaNivelada(saldoUVR, eaToEm(tasaEARealDec), mesesRestantes), 8);
      }

      function proyectarUVRPorInflacion(valorUvrBase, inflacionEAdec, fechaBase, fechaObjetivo) {
        const dias = Math.max(0, diffDays(fechaBase, fechaObjetivo));
        const factor = Math.pow(1 + (Number(inflacionEAdec) || 0), dias / 365.2425);
        return roundTo((Number(valorUvrBase) || uvrActual) * factor, 8);
      }

      function obtenerContextoUVR(ob, warnings = []) {
        const meta = ob?.uvr || {};
        const valorUVRBase = sanearValorUvr(meta.valorUVRBase || meta.valorUVRActual || uvrActual, warnings);
        const inflacionEsperadaEA = sanearInflacionPct(meta.inflacionEsperadaEA ?? UVR_CONFIG.DEFAULT_INFLATION_EA, warnings);
        const fechaUVRBase = toIsoDate(meta.fechaUVRBase || meta.fechaDesembolso || hoyISO(), hoyISO());
        return {
          valorUVRBase,
          inflacionEsperadaEA,
          inflacionEsperadaDec: parsePctToDec(inflacionEsperadaEA),
          fechaUVRBase
        };
      }

      function obtenerUVRProyectadaObligacion(ob, fechaObjetivo = hoyISO(), warnings = []) {
        if (!esCreditoUVR(ob)) return uvrActual;
        const contexto = obtenerContextoUVR(ob, warnings);
        return proyectarUVRPorInflacion(
          contexto.valorUVRBase,
          contexto.inflacionEsperadaDec,
          contexto.fechaUVRBase,
          fechaObjetivo
        );
      }

      function obtenerSaldoActualCOP(ob, fechaObjetivo = hoyISO()) {
        if (!esCreditoUVR(ob)) return Number(ob?.saldoActual || 0);
        return roundTo(uvrToCop(Number(ob?.saldoActual || 0), obtenerUVRProyectadaObligacion(ob, fechaObjetivo)), 2);
      }

      function formatearDualUVR(valorUVR, valorCOP) {
        return `${fmtUVR(valorUVR)} | ${fmtCOP(valorCOP)}`;
      }

      function renderizarValorUVRActual() {
        const label = byId('uvrValorActual');
        if (label) label.textContent = fmtCOP(Math.round(uvrActual));
        const manualInput = byId('uvrManual');
        if (manualInput && document.activeElement !== manualInput) {
          manualInput.value = roundTo(uvrActual, 4).toFixed(4);
        }
      }

      function mostrarAdvertenciasUVRFormulario(warnings = []) {
        const box = byId('uvrWarningBox');
        if (!box) return;
        if (!warnings.length) {
          box.style.display = 'none';
          box.innerHTML = '';
          return;
        }

        box.style.display = 'block';
        box.innerHTML = warnings.map((warning) => `<div>${warning}</div>`).join('');
      }

      function construirResumenUVRDesdeFormulario() {
        const warnings = [];
        const valorCreditoCOP = getInputMoneyValue('valorCredito');
        const interesEA = Number(byId('interesEA')?.value);
        const numeroCuota = Number(byId('numeroCuota')?.value);
        const cantidadCuotas = Number(byId('cantidadCuotas')?.value);
        const fechaDesembolsoInput = byId('fechaDesembolsoUVR')?.value;
        const fechaDesembolso = fechaDesembolsoInput ? toIsoDate(fechaDesembolsoInput) : hoyISO();
        const fechaUVRBase = hoyISO();
        const fechaVencimiento = byId('fechaVencimiento')?.value || addMonthsIso(hoyISO(), 1);
        const inflacionEsperadaEA = sanearInflacionPct(byId('inflacionEsperadaEA')?.value, warnings);
        const valorUVRBase = sanearValorUvr(byId('uvrManual')?.value || uvrActual, warnings);

        if (!fechaDesembolsoInput) {
          pushWarning(warnings, 'No indicaste fecha de desembolso. Se usa la fecha actual como referencia.');
        }

        const cuotasRestantes = Math.max(1, (Number.isFinite(cantidadCuotas) ? cantidadCuotas : 1) - (Number.isFinite(numeroCuota) ? numeroCuota : 1) + 1);
        const saldoActualUVR = valorCreditoCOP > 0 ? copToUvr(valorCreditoCOP, valorUVRBase) : 0;
        const cuotaUVR = (saldoActualUVR > 0 && interesEA >= 0 && cuotasRestantes > 0)
          ? calcularCuotaFijaUVR(saldoActualUVR, parsePctToDec(interesEA), cuotasRestantes)
          : 0;
        const valorUvrPrimerVencimiento = proyectarUVRPorInflacion(
          valorUVRBase,
          parsePctToDec(inflacionEsperadaEA),
          fechaUVRBase,
          fechaVencimiento
        );

        return {
          warnings,
          valorCreditoCOP,
          interesEA,
          numeroCuota,
          cantidadCuotas,
          cuotasRestantes,
          fechaDesembolso,
          fechaUVRBase,
          fechaVencimiento,
          inflacionEsperadaEA,
          valorUVRBase,
          saldoActualUVR: roundTo(saldoActualUVR, 8),
          cuotaUVR: roundTo(cuotaUVR, 8),
          cuotaCOPPrimerMes: roundTo(uvrToCop(cuotaUVR, valorUvrPrimerVencimiento), 2),
          valorUvrPrimerVencimiento: roundTo(valorUvrPrimerVencimiento, 8)
        };
      }

      function actualizarResumenUVRFormulario() {
        if (byId('tipoCredito')?.value !== 'vivienda' || monedaSeleccionada !== 'UVR') {
          mostrarAdvertenciasUVRFormulario([]);
          return;
        }

        const resumen = construirResumenUVRDesdeFormulario();
        if (byId('equivalenciaCreditoUVR')) {
          byId('equivalenciaCreditoUVR').value = resumen.saldoActualUVR > 0
            ? formatearDualUVR(resumen.saldoActualUVR, resumen.valorCreditoCOP)
            : '';
        }
        if (byId('cuotaCalculadaUVR')) {
          byId('cuotaCalculadaUVR').value = resumen.cuotaUVR > 0 ? fmtUVR(resumen.cuotaUVR) : '';
        }
        if (byId('cuotaEstimadaCOPUVR')) {
          byId('cuotaEstimadaCOPUVR').value = resumen.cuotaUVR > 0
            ? `${fmtCOP(resumen.cuotaCOPPrimerMes)} (UVR ${resumen.valorUvrPrimerVencimiento.toFixed(4)})`
            : '';
        }

        mostrarAdvertenciasUVRFormulario(resumen.warnings);
      }

      function actualizarVisibilidadCamposUVR() {
        const esVivienda = byId('tipoCredito')?.value === 'vivienda';
        const container = byId('monedaViviendaContainer');
        const camposUVR = byId('uvrCamposContainer');
        const grupoCuota = byId('grupoValorCuota');
        const valorCuotaInput = byId('valorCuota');
        const copOption = byId('monedaCopOption');
        const uvrOption = byId('monedaUvrOption');
        const uvrInfo = byId('uvrInfo');

        if (container) container.style.display = esVivienda ? 'block' : 'none';
        if (!esVivienda) monedaSeleccionada = 'COP';

        const modoUVR = esVivienda && monedaSeleccionada === 'UVR';
        if (copOption) copOption.classList.toggle('selected', monedaSeleccionada === 'COP');
        if (uvrOption) uvrOption.classList.toggle('selected', monedaSeleccionada === 'UVR');
        if (uvrInfo) uvrInfo.style.display = modoUVR ? 'flex' : 'none';
        if (camposUVR) camposUVR.style.display = modoUVR ? 'block' : 'none';
        if (grupoCuota) grupoCuota.style.display = modoUVR ? 'none' : 'block';
        if (valorCuotaInput) {
          valorCuotaInput.disabled = modoUVR;
          valorCuotaInput.required = !modoUVR;
        }

        renderizarValorUVRActual();
        actualizarResumenUVRFormulario();
      }

      async function consultarUVRActual() {
        const endpoint = (window.BOLA_NIEVE_UVR_API_URL || '').trim();
        if (!endpoint) {
          uvrFuenteActual = 'manual';
          renderizarValorUVRActual();
          if (typeof window.notificar === 'function') {
            window.notificar('La conexion de la api esta en proceso. Puedes editar el valor manualmente.', 'info');
          }
          return uvrActual;
        }

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), UVR_CONFIG.API_TIMEOUT_MS);

        try {
          const response = await fetch(endpoint, { signal: controller.signal });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const payload = await response.json();
          const valor = Number(
            payload?.valorUVR ??
            payload?.uvr ??
            payload?.data?.valorUVR ??
            payload?.data?.uvr ??
            payload?.value
          );
          if (!Number.isFinite(valor) || valor < UVR_CONFIG.MIN_UVR_VALUE) {
            throw new Error('La API no devolvio un valor UVR numerico.');
          }

          uvrActual = roundTo(valor, 8);
          uvrFuenteActual = 'api';
          renderizarValorUVRActual();
          actualizarResumenUVRFormulario();
          return uvrActual;
        } catch (error) {
          uvrFuenteActual = 'manual';
          renderizarValorUVRActual();
          if (typeof window.notificar === 'function') {
            window.notificar('No fue posible consultar la UVR por API. Se conserva el valor manual.', 'warning');
          }
          return uvrActual;
        } finally {
          clearTimeout(timeout);
        }
      }

      function normalizarAbonoHistorico(ob, abono) {
        if (!abono) return abono;

        const tipoMovimiento = abono.tipoMovimiento === TIPOS_MOVIMIENTO.ABONO_CAPITAL
          ? TIPOS_MOVIMIENTO.ABONO_CAPITAL
          : TIPOS_MOVIMIENTO.PAGO_CUOTA;
        const cuotaPagadaCOP = esNumeroFinito(abono.cuotaPagadaCOP)
          ? Number(abono.cuotaPagadaCOP)
          : roundTo(Number(abono.amortizacionCuota || 0) + Number(abono.interesPeriodo || 0), 2);

        if (!esCreditoUVR(ob)) {
          return {
            ...abono,
            tipoMovimiento,
            cuotaPagadaCOP,
            montoAbonoCOP: esNumeroFinito(abono.montoAbonoCOP) ? Number(abono.montoAbonoCOP) : Number(abono.monto || 0),
            ahorroInteresesCOPReales: esNumeroFinito(abono.ahorroInteresesCOPReales) ? Number(abono.ahorroInteresesCOPReales) : Number(abono.ahorroIntereses || 0)
          };
        }

        const warnings = [];
        const uvrOperacion = sanearValorUvr(abono.uvrOperacion || ob?.uvr?.valorUVRActual || ob?.uvr?.valorUVRBase || uvrActual, warnings);
        const montoAbonoUVR = esNumeroFinito(abono.montoAbonoUVR) ? Number(abono.montoAbonoUVR) : Number(abono.monto || 0);
        const ahorroInteresesUVR = esNumeroFinito(abono.ahorroInteresesUVR) ? Number(abono.ahorroInteresesUVR) : Number(abono.ahorroIntereses || 0);

        return {
          ...abono,
          tipoMovimiento,
          cuotaPagadaCOP,
          cuotaPagadaUVR: esNumeroFinito(abono.cuotaPagadaUVR) ? Number(abono.cuotaPagadaUVR) : 0,
          uvrOperacion,
          montoAbonoUVR,
          montoAbonoCOP: esNumeroFinito(abono.montoAbonoCOP) ? Number(abono.montoAbonoCOP) : uvrToCop(montoAbonoUVR, uvrOperacion),
          ahorroInteresesUVR,
          ahorroInteresesCOPReales: esNumeroFinito(abono.ahorroInteresesCOPReales) ? Number(abono.ahorroInteresesCOPReales) : uvrToCop(ahorroInteresesUVR, uvrOperacion),
          saldoPosteriorUVR: esNumeroFinito(abono.saldoPosteriorUVR) ? Number(abono.saldoPosteriorUVR) : Number(abono.saldoPosterior || 0),
          saldoPosteriorCOP: esNumeroFinito(abono.saldoPosteriorCOP) ? Number(abono.saldoPosteriorCOP) : uvrToCop(Number(abono.saldoPosterior || 0), uvrOperacion)
        };
      }

      function normalizarObligacionUVR(ob) {
        if (!esCreditoUVR(ob)) {
          return {
            ...ob,
            historicoAbonos: (ob.historicoAbonos || []).map((abono) => normalizarAbonoHistorico(ob, abono))
          };
        }

        const warnings = [];
        const valorUVRBase = sanearValorUvr(ob?.uvr?.valorUVRBase || ob?.uvr?.valorUVRActual || uvrActual, warnings);
        const inflacionEsperadaEA = sanearInflacionPct(ob?.uvr?.inflacionEsperadaEA ?? UVR_CONFIG.DEFAULT_INFLATION_EA, warnings);
        const fechaUVRBase = toIsoDate(ob?.uvr?.fechaUVRBase || hoyISO(), hoyISO());
        const cuotasRestantes = Math.max(1, Number(ob.cantidadCuotas || 1) - Number(ob.numeroCuota || 1) + 1);

        let saldoActualUVR = Number(ob.saldoActual || 0);
        let valorCuotaUVR = Number(ob.valorCuota || 0);

        if (!ob.uvr) {
          saldoActualUVR = copToUvr(Number(ob.saldoActual || ob.valorCredito || 0), valorUVRBase);
          valorCuotaUVR = Number(ob.valorCuota || 0) > 0 ? copToUvr(Number(ob.valorCuota || 0), valorUVRBase) : 0;
        }

        if (saldoActualUVR > 0 && valorCuotaUVR <= 0) {
          valorCuotaUVR = calcularCuotaFijaUVR(saldoActualUVR, parsePctToDec(ob.interesEA), cuotasRestantes);
        }

        const obNormalizada = {
          ...ob,
          valorCredito: roundTo(Number(ob.valorCredito || saldoActualUVR), 8),
          saldoActual: roundTo(saldoActualUVR, 8),
          valorCuota: roundTo(valorCuotaUVR, 8),
          uvr: {
            origen: ob?.uvr?.origen || 'manual',
            fechaDesembolso: toIsoDate(ob?.uvr?.fechaDesembolso || hoyISO(), hoyISO()),
            fechaUVRBase,
            valorUVRBase,
            valorUVRActual: valorUVRBase,
            inflacionEsperadaEA,
            cuotaUVR: roundTo(valorCuotaUVR, 8),
            saldoActualUVR: roundTo(saldoActualUVR, 8),
            saldoActualCOP: roundTo(uvrToCop(saldoActualUVR, valorUVRBase), 2),
            cuotaPesosEstimada: roundTo(uvrToCop(valorCuotaUVR, valorUVRBase), 2),
            advertencias: warnings
          }
        };

        obNormalizada.historicoAbonos = (ob.historicoAbonos || []).map((abono) => normalizarAbonoHistorico(obNormalizada, abono));
        return obNormalizada;
      }

      function obtenerMontoAbonoCOP(ob, abono) {
        if (!abono) return 0;
        if (!esCreditoUVR(ob)) return Number(abono.montoAbonoCOP || abono.monto || 0);
        return Number(abono.montoAbonoCOP || 0);
      }

      function obtenerAhorroInteresesCOP(ob, abono) {
        if (!abono) return 0;
        if (!esCreditoUVR(ob)) return Number(abono.ahorroInteresesCOPReales || abono.ahorroIntereses || 0);
        return Number(abono.ahorroInteresesCOPReales || 0);
      }

      function normalizarTipoMovimiento(tipoMovimiento) {
        return tipoMovimiento === TIPOS_MOVIMIENTO.ABONO_CAPITAL
          ? TIPOS_MOVIMIENTO.ABONO_CAPITAL
          : TIPOS_MOVIMIENTO.PAGO_CUOTA;
      }

      function esMovimientoAbonoCapital(movimiento) {
        return normalizarTipoMovimiento(movimiento?.tipoMovimiento) === TIPOS_MOVIMIENTO.ABONO_CAPITAL;
      }

      function obtenerEtiquetaTipoMovimiento(movimiento, ob = null) {
        if (esMovimientoAbonoCapital(movimiento)) return 'Abono a capital';
        const abonoCapital = ob ? obtenerMontoAbonoCOP(ob, movimiento) : Number(movimiento?.montoAbonoCOP || movimiento?.monto || 0);
        return abonoCapital > 0 ? 'Pago de cuota + abono' : 'Pago de cuota';
      }

      function contarMovimientosCapital(ob, historico = ob?.historicoAbonos || []) {
        return historico.reduce((total, movimiento) => {
          const aplicaCapital = esMovimientoAbonoCapital(movimiento) || obtenerMontoAbonoCOP(ob, movimiento) > 0;
          return total + (aplicaCapital ? 1 : 0);
        }, 0);
      }

      function formatearMontoMovimiento(ob, montoCOP = 0, montoUVR = 0) {
        if (esCreditoUVR(ob) && Number(montoUVR || 0) > 0) {
          return formatearDualUVR(montoUVR, montoCOP);
        }
        return fmtCOP(montoCOP);
      }

      function formatearSaldoPosteriorMovimiento(ob, movimiento) {
        const saldoCOP = esNumeroFinito(movimiento?.saldoPosteriorCOP)
          ? Number(movimiento.saldoPosteriorCOP)
          : Number(movimiento?.saldoPosterior || 0);
        if (esCreditoUVR(ob) && esNumeroFinito(movimiento?.saldoPosteriorUVR)) {
          return formatearDualUVR(Number(movimiento.saldoPosteriorUVR || 0), saldoCOP);
        }
        return fmtCOP(saldoCOP);
      }

      function obtenerSaldoEdicionCOP(ob) {
        if (!esCreditoUVR(ob)) return Number(ob?.saldoActual || 0);
        const valorUVRBase = sanearValorUvr(ob?.uvr?.valorUVRBase || ob?.uvr?.valorUVRActual || uvrActual);
        return roundTo(uvrToCop(Number(ob?.saldoActual || 0), valorUVRBase), 2);
      }

      function obtenerValorCreditoBaseCOP(ob) {
        if (!esCreditoUVR(ob)) return Number(ob?.valorCredito || ob?.saldoActual || 0);
        const valorUVRBase = sanearValorUvr(ob?.uvr?.valorUVRBase || ob?.uvr?.valorUVRActual || uvrActual);
        return roundTo(uvrToCop(Number(ob?.valorCredito || ob?.saldoActual || 0), valorUVRBase), 2);
      }

      function obtenerMetricasObligacionActiva(ob) {
        const historico = ob?.historicoAbonos || [];
        return historico.reduce((acc, abono) => {
          acc.intereses += obtenerAhorroInteresesCOP(ob, abono);
          acc.capital += obtenerMontoAbonoCOP(ob, abono);
          acc.cuotas += Number(abono?.mesesAhorrados || 0);
          return acc;
        }, { intereses: 0, capital: 0, cuotas: 0 });
      }

      function normalizarObligacionCerrada(cerrada) {
        if (!cerrada) return cerrada;

        const moneda = cerrada.moneda || 'COP';
        const referenciaObligacion = normalizarObligacionUVR({
          id: cerrada.id || crypto.randomUUID(),
          entidad: cerrada.entidad || '',
          tipoCredito: cerrada.tipoCredito || (moneda === 'UVR' ? 'vivienda' : 'otros'),
          moneda,
          saldoActual: Number(cerrada.saldoFinal || 0),
          valorCredito: Number(cerrada.valorCreditoOriginal || cerrada.saldoFinal || 0),
          valorCuota: 0,
          interesEA: Number(cerrada.interesEA || 0),
          numeroCuota: 1,
          cantidadCuotas: 1,
          historicoAbonos: cerrada.historicoAbonos || [],
          uvr: cerrada.uvr
        });

        const historicoAbonos = (cerrada.historicoAbonos || []).map((abono) => normalizarAbonoHistorico(referenciaObligacion, abono));
        const totalAbonosCOP = esNumeroFinito(cerrada.totalAbonosCOP)
          ? Number(cerrada.totalAbonosCOP)
          : historicoAbonos.reduce((sum, abono) => sum + obtenerMontoAbonoCOP(referenciaObligacion, abono), 0);
        const totalInteresesCOP = esNumeroFinito(cerrada.interesesDejadosDePagarCOP)
          ? Number(cerrada.interesesDejadosDePagarCOP)
          : historicoAbonos.reduce((sum, abono) => sum + obtenerAhorroInteresesCOP(referenciaObligacion, abono), 0);
        const capitalAmortizado = esNumeroFinito(cerrada.capitalAmortizado)
          ? Number(cerrada.capitalAmortizado)
          : totalAbonosCOP;
        const totalAbonosUVR = moneda === 'UVR'
          ? (esNumeroFinito(cerrada.totalAbonosUVR)
            ? Number(cerrada.totalAbonosUVR)
            : historicoAbonos.reduce((sum, abono) => sum + Number(abono?.montoAbonoUVR || 0), 0))
          : 0;
        const interesesDejadosDePagarUVR = moneda === 'UVR'
          ? (esNumeroFinito(cerrada.interesesDejadosDePagarUVR)
            ? Number(cerrada.interesesDejadosDePagarUVR)
            : historicoAbonos.reduce((sum, abono) => sum + Number(abono?.ahorroInteresesUVR || 0), 0))
          : 0;
        const valorCreditoOriginalCOP = esNumeroFinito(cerrada.valorCreditoOriginalCOP)
          ? Number(cerrada.valorCreditoOriginalCOP)
          : (moneda === 'UVR'
            ? roundTo(uvrToCop(
                Number(cerrada.valorCreditoOriginal || 0),
                sanearValorUvr(cerrada?.uvr?.valorUVRBase || referenciaObligacion?.uvr?.valorUVRBase || uvrActual)
              ), 2)
            : Number(cerrada.valorCreditoOriginal || 0));

        return {
          ...cerrada,
          moneda,
          historicoAbonos,
          totalAbonosCOP,
          totalAbonosUVR,
          interesesDejadosDePagar: totalInteresesCOP,
          interesesDejadosDePagarCOP: totalInteresesCOP,
          interesesDejadosDePagarUVR,
          capitalAmortizado,
          valorCreditoOriginalCOP
        };
      }

      function obtenerMetricasObligacionCerrada(cerrada) {
        const cerradaNormalizada = normalizarObligacionCerrada(cerrada);
        return {
          intereses: Number(cerradaNormalizada?.interesesDejadosDePagarCOP || cerradaNormalizada?.interesesDejadosDePagar || 0),
          capital: Number(cerradaNormalizada?.capitalAmortizado || cerradaNormalizada?.totalAbonosCOP || 0),
          cuotas: Number(cerradaNormalizada?.cuotasDejadasDePagar || 0)
        };
      }

      function calcularVariacionSaldoEdicion(obAnterior, obEditada) {
        const saldoAnteriorCOP = obtenerSaldoEdicionCOP(obAnterior);
        const saldoNuevoCOP = obtenerSaldoEdicionCOP(obEditada);
        const diferenciaCOP = Math.abs(saldoNuevoCOP - saldoAnteriorCOP);
        const ratio = saldoAnteriorCOP > 0 ? diferenciaCOP / saldoAnteriorCOP : (diferenciaCOP > 0 ? 1 : 0);

        return {
          saldoAnteriorCOP,
          saldoNuevoCOP,
          diferenciaCOP,
          ratio
        };
      }

      function evaluarPreservacionHistoricoEdicion(obAnterior, obEditada) {
        const historico = obAnterior?.historicoAbonos || [];
        if (historico.length === 0) {
          return { preserve: true, reason: 'sin_historico', ratio: 0, diferenciaCOP: 0 };
        }

        if (obAnterior?.moneda !== obEditada?.moneda || obAnterior?.tipoCredito !== obEditada?.tipoCredito) {
          return { preserve: false, reason: 'estructura', ...calcularVariacionSaldoEdicion(obAnterior, obEditada) };
        }

        const variacion = calcularVariacionSaldoEdicion(obAnterior, obEditada);
        return {
          preserve: variacion.ratio <= EDITION_HISTORY_MAX_SALDO_VARIATION,
          reason: variacion.ratio <= EDITION_HISTORY_MAX_SALDO_VARIATION ? 'saldo_estable' : 'saldo_alterado',
          ...variacion
        };
      }

      window.toggleMonedaVivienda = function() {
        actualizarVisibilidadCamposUVR();
      };

      window.seleccionarMoneda = function(moneda) {
        monedaSeleccionada = moneda;
        actualizarVisibilidadCamposUVR();
      };

      // Función para convertir UVR a COP
      function uvrToCop(uvr, valorUvr = uvrActual) {
        return (Number(uvr) || 0) * (Number(valorUvr) || 0);
      }

      function copToUvr(cop, valorUvr = uvrActual) {
        const divisor = Number(valorUvr) || 0;
        if (divisor <= 0) return 0;
        return (Number(cop) || 0) / divisor;
      }

      // Actualizar valor UVR cada mes (simulado)
      function actualizarUVR() {
        renderizarValorUVRActual();
        return uvrActual;
      }

      /* ========= INICIALIZACIÓN ========= */
      function inicializar() {
        cargarEntidades();
        cargarDatos();
        cargarLogros();
        renderizarTodo();
        inicializarEventListeners();
        verificarRecordatorios();
        setInterval(verificarRecordatorios, 60000);
        actualizarOfertas();
        renderizarValorUVRActual();
        consultarUVRActual();
      }

      function cargarEntidades() {
        const entidadesBase = ["Bancolombia", "Davivienda", "BBVA", "Lulo Bank", "Nu", "Nequi", "Addi", "Banco de Bogotá", "Banco de Occidente"];
        const guardadas = localStorage.getItem(STORAGE_KEYS.ENTIDADES);
        entidadesListado = guardadas ? JSON.parse(guardadas) : entidadesBase;
        byId('entidadSelect').innerHTML = entidadesListado.map(e => `<option value="${e}">${e}</option>`).join('');
      }

      function cargarDatos() {
        try {
          obligaciones = JSON.parse(localStorage.getItem(STORAGE_KEYS.OBLIGACIONES) || '[]')
            .map(o => normalizarObligacionUVR({
              ...o,
              cantidadCuotasOriginal: o.cantidadCuotasOriginal ?? o.cantidadCuotas,
              cuotaInicial: o.cuotaInicial || o.numeroCuota,
              historicoAbonos: o.historicoAbonos || [],
              moneda: o.moneda || 'COP'
            }));
          obligacionesCerradas = JSON.parse(localStorage.getItem(STORAGE_KEYS.OBLIGACIONES_CERRADAS) || '[]')
            .map((cerrada) => normalizarObligacionCerrada(cerrada));
        } catch (e) {
          obligaciones = [];
          obligacionesCerradas = [];
        }
      }

      function guardarDatos() {
        localStorage.setItem(STORAGE_KEYS.OBLIGACIONES, JSON.stringify(obligaciones));
        localStorage.setItem(STORAGE_KEYS.OBLIGACIONES_CERRADAS, JSON.stringify(obligacionesCerradas));
      }

      function cargarLogros() {
        logrosDesbloqueados = JSON.parse(localStorage.getItem(STORAGE_KEYS.LOGROS) || '[]');
      }

      function guardarLogros() {
        localStorage.setItem(STORAGE_KEYS.LOGROS, JSON.stringify(logrosDesbloqueados));
      }

      function notificar(msg, tipo = 'info') {
        const id = Date.now();
        const n = document.createElement('div');
        n.className = `notif ${tipo}`;
        n.id = `n-${id}`;
        n.innerHTML = `<div>${tipo === 'success' ? '✅' : tipo === 'warning' ? '⚠️' : '🔔'} ${msg}</div>
                      <button class="close" onclick="this.parentElement.remove()">✕</button>`;
        byId('notifications').appendChild(n);
        setTimeout(() => byId(`n-${id}`)?.remove(), 5000);
      }

      function lanzarConfeti(cantidad = 100) {
        if (typeof confetti !== 'undefined') {
          confetti({
            particleCount: cantidad,
            spread: 70,
            origin: { y: 0.6 },
            colors: ['#1F4E79', '#00A86B', '#FF6F61', '#F59E0B']
          });
        }
      }

      /* ========= MOTOR FINANCIERO ========= */
      function eaToEm(eaDec) {
        return Math.pow(1 + eaDec, 1/12) - 1;
      }

      function simularIntereses(saldoInicial, em, valorCuota, maxMeses = 600, moneda = 'COP') {
        let saldo = saldoInicial;
        let interesesAcum = 0;
        let meses = 0;

        for (let i = 0; i < maxMeses; i++) {
          if (saldo <= 0) break;
          const interesPeriodo = saldo * em;
          const pagoCuota = Math.min(valorCuota, saldo + interesPeriodo);
          const amortizacion = Math.max(0, pagoCuota - interesPeriodo);
          if (amortizacion <= 0 && saldo > 0) break;
          saldo -= amortizacion;
          interesesAcum += interesPeriodo;
          meses++;
        }
        return { interesesAcum, meses, saldoFinal: Math.max(0, saldo) };
      }

      function simularPlanPagosUVR({
        saldoInicialUVR,
        tasaEARealDec,
        cuotaUVR,
        inflacionEsperadaEA,
        valorUVRBase,
        fechaUVRBase,
        fechaInicio,
        maxMeses = UVR_CONFIG.MAX_SIMULATION_MONTHS,
        incluirDetalle = false
      }) {
        const detalle = [];
        const warnings = [];
        const em = eaToEm(Number(tasaEARealDec) || 0);
        const inflacionPct = sanearInflacionPct(inflacionEsperadaEA, warnings);
        const inflacionDec = parsePctToDec(inflacionPct);
        const uvrBase = sanearValorUvr(valorUVRBase, warnings);
        const fechaBase = toIsoDate(fechaUVRBase || hoyISO(), hoyISO());
        const fechaPrimerPago = toIsoDate(fechaInicio || addMonthsIso(fechaBase, 1), addMonthsIso(fechaBase, 1));

        let saldo = Number(saldoInicialUVR) || 0;
        let totalInteresesUVR = 0;
        let totalInteresesCOPNominales = 0;
        let totalCuotasCOPNominales = 0;
        let meses = 0;
        let amortiza = true;

        if (saldo <= UVR_CONFIG.EPSILON_UVR || (Number(cuotaUVR) || 0) <= 0) {
          return {
            meses: 0,
            saldoFinalUVR: Math.max(0, saldo),
            totalInteresesUVR: 0,
            totalInteresesCOPNominales: 0,
            totalCuotasCOPNominales: 0,
            detalle,
            warnings,
            amortiza: saldo <= UVR_CONFIG.EPSILON_UVR
          };
        }

        for (let i = 0; i < maxMeses && saldo > UVR_CONFIG.EPSILON_UVR; i++) {
          const fechaCuota = addMonthsIso(fechaPrimerPago, i);
          const valorUvrPeriodo = proyectarUVRPorInflacion(uvrBase, inflacionDec, fechaBase, fechaCuota);
          const interesUVR = saldo * em;
          const cuotaAplicadaUVR = Math.min(Number(cuotaUVR) || 0, saldo + interesUVR);
          const amortizacionUVR = Math.max(0, cuotaAplicadaUVR - interesUVR);

          if (amortizacionUVR <= UVR_CONFIG.EPSILON_UVR) {
            amortiza = false;
            pushWarning(warnings, 'La cuota UVR ya no amortiza capital bajo los supuestos actuales.');
            break;
          }

          saldo = Math.max(0, saldo - amortizacionUVR);
          totalInteresesUVR += interesUVR;
          totalInteresesCOPNominales += uvrToCop(interesUVR, valorUvrPeriodo);
          totalCuotasCOPNominales += uvrToCop(cuotaAplicadaUVR, valorUvrPeriodo);
          meses++;

          if (incluirDetalle) {
            detalle.push({
              mes: i + 1,
              fecha: fechaCuota,
              valorUVR: valorUvrPeriodo,
              cuotaUVR: cuotaAplicadaUVR,
              cuotaCOP: uvrToCop(cuotaAplicadaUVR, valorUvrPeriodo),
              interesUVR,
              interesCOP: uvrToCop(interesUVR, valorUvrPeriodo),
              amortizacionUVR,
              amortizacionCOP: uvrToCop(amortizacionUVR, valorUvrPeriodo),
              saldoFinalUVR: saldo,
              saldoFinalCOP: uvrToCop(saldo, valorUvrPeriodo)
            });
          }
        }

        return {
          meses,
          saldoFinalUVR: Math.max(0, saldo),
          totalInteresesUVR: roundTo(totalInteresesUVR, 8),
          totalInteresesCOPNominales: roundTo(totalInteresesCOPNominales, 2),
          totalCuotasCOPNominales: roundTo(totalCuotasCOPNominales, 2),
          detalle,
          warnings,
          amortiza
        };
      }

      /* ========= SIMULACIONES DE AHORRO CON ABONO CONSTANTE ========= */
      function simularPlanPagosConstantesCOP({
        saldoInicial,
        em,
        valorCuota,
        abonoConstanteCOP = 0,
        maxMeses = UVR_CONFIG.MAX_SIMULATION_MONTHS
      }) {
        const warnings = [];
        const cuota = Math.max(0, Number(valorCuota) || 0);
        const abonoConstante = Math.max(0, Number(abonoConstanteCOP) || 0);
        let saldo = Math.max(0, Number(saldoInicial) || 0);
        let totalInteresesCOP = 0;
        let totalCuotasCOP = 0;
        let totalAbonosCOP = 0;
        let meses = 0;
        let amortiza = true;

        if (saldo <= 0) {
          return {
            meses: 0,
            saldoFinal: 0,
            totalInteresesCOP: 0,
            totalCuotasCOP: 0,
            totalAbonosCOP: 0,
            totalPagadoCOP: 0,
            warnings,
            amortiza: true
          };
        }

        for (let i = 0; i < maxMeses && saldo > 0.01; i++) {
          const interesPeriodo = saldo * em;
          const cuotaAplicada = Math.min(cuota, saldo + interesPeriodo);
          const amortizacionCuota = Math.max(0, cuotaAplicada - interesPeriodo);
          const saldoTrasCuota = Math.max(0, saldo - amortizacionCuota);
          const abonoAplicado = Math.min(abonoConstante, saldoTrasCuota);

          if (amortizacionCuota <= 0 && abonoAplicado <= 0) {
            amortiza = false;
            pushWarning(warnings, 'La cuota actual no amortiza capital en el escenario base.');
            break;
          }

          saldo = Math.max(0, saldoTrasCuota - abonoAplicado);
          totalInteresesCOP += interesPeriodo;
          totalCuotasCOP += cuotaAplicada;
          totalAbonosCOP += abonoAplicado;
          meses++;
        }

        return {
          meses,
          saldoFinal: roundTo(Math.max(0, saldo), 2),
          totalInteresesCOP: roundTo(totalInteresesCOP, 2),
          totalCuotasCOP: roundTo(totalCuotasCOP, 2),
          totalAbonosCOP: roundTo(totalAbonosCOP, 2),
          totalPagadoCOP: roundTo(totalCuotasCOP + totalAbonosCOP, 2),
          warnings,
          amortiza
        };
      }

      function simularPlanPagosConstantesUVR({
        saldoInicialUVR,
        tasaEARealDec,
        cuotaUVR,
        abonoConstanteCOP = 0,
        inflacionEsperadaEA,
        valorUVRBase,
        fechaUVRBase,
        fechaInicio,
        maxMeses = UVR_CONFIG.MAX_SIMULATION_MONTHS
      }) {
        const warnings = [];
        const em = eaToEm(Number(tasaEARealDec) || 0);
        const inflacionPct = sanearInflacionPct(inflacionEsperadaEA, warnings);
        const inflacionDec = parsePctToDec(inflacionPct);
        const uvrBase = sanearValorUvr(valorUVRBase, warnings);
        const fechaBase = toIsoDate(fechaUVRBase || hoyISO(), hoyISO());
        const fechaPrimerPago = toIsoDate(fechaInicio || addMonthsIso(fechaBase, 1), addMonthsIso(fechaBase, 1));
        const cuota = Math.max(0, Number(cuotaUVR) || 0);
        const abonoConstante = Math.max(0, Number(abonoConstanteCOP) || 0);

        let saldo = Math.max(0, Number(saldoInicialUVR) || 0);
        let totalInteresesUVR = 0;
        let totalInteresesCOP = 0;
        let totalCuotasCOP = 0;
        let totalAbonosCOP = 0;
        let totalAbonosUVR = 0;
        let meses = 0;
        let amortiza = true;

        const valorUvrPrimerPago = proyectarUVRPorInflacion(uvrBase, inflacionDec, fechaBase, fechaPrimerPago);
        const abonoConstanteUVRAproximado = abonoConstante > 0
          ? roundTo(copToUvr(abonoConstante, valorUvrPrimerPago), 8)
          : 0;

        if (saldo <= UVR_CONFIG.EPSILON_UVR) {
          return {
            meses: 0,
            saldoFinalUVR: 0,
            totalInteresesUVR: 0,
            totalInteresesCOP: 0,
            totalCuotasCOP: 0,
            totalAbonosCOP: 0,
            totalAbonosUVR: 0,
            totalPagadoCOP: 0,
            warnings,
            amortiza: true,
            abonoConstanteUVRAproximado
          };
        }

        for (let i = 0; i < maxMeses && saldo > UVR_CONFIG.EPSILON_UVR; i++) {
          const fechaCuota = addMonthsIso(fechaPrimerPago, i);
          const valorUvrPeriodo = proyectarUVRPorInflacion(uvrBase, inflacionDec, fechaBase, fechaCuota);
          const interesUVR = saldo * em;
          const cuotaAplicadaUVR = Math.min(cuota, saldo + interesUVR);
          const amortizacionCuotaUVR = Math.max(0, cuotaAplicadaUVR - interesUVR);
          const saldoTrasCuotaUVR = Math.max(0, saldo - amortizacionCuotaUVR);
          const abonoAplicadoUVR = abonoConstante > 0
            ? Math.min(copToUvr(abonoConstante, valorUvrPeriodo), saldoTrasCuotaUVR)
            : 0;

          if (amortizacionCuotaUVR <= UVR_CONFIG.EPSILON_UVR && abonoAplicadoUVR <= UVR_CONFIG.EPSILON_UVR) {
            amortiza = false;
            pushWarning(warnings, 'La cuota UVR no amortiza capital bajo los supuestos actuales.');
            break;
          }

          saldo = Math.max(0, saldoTrasCuotaUVR - abonoAplicadoUVR);
          totalInteresesUVR += interesUVR;
          totalInteresesCOP += uvrToCop(interesUVR, valorUvrPeriodo);
          totalCuotasCOP += uvrToCop(cuotaAplicadaUVR, valorUvrPeriodo);
          totalAbonosCOP += uvrToCop(abonoAplicadoUVR, valorUvrPeriodo);
          totalAbonosUVR += abonoAplicadoUVR;
          meses++;
        }

        return {
          meses,
          saldoFinalUVR: roundTo(Math.max(0, saldo), 8),
          totalInteresesUVR: roundTo(totalInteresesUVR, 8),
          totalInteresesCOP: roundTo(totalInteresesCOP, 2),
          totalCuotasCOP: roundTo(totalCuotasCOP, 2),
          totalAbonosCOP: roundTo(totalAbonosCOP, 2),
          totalAbonosUVR: roundTo(totalAbonosUVR, 8),
          totalPagadoCOP: roundTo(totalCuotasCOP + totalAbonosCOP, 2),
          warnings,
          amortiza,
          abonoConstanteUVRAproximado
        };
      }

      function simularEscenarioConstanteObligacion(ob, abonoConstanteCOP = 0) {
        const fechaInicio = obtenerFechaInicioProyeccionObligacion(ob);
        if (!ob || Number(ob?.saldoActual || 0) <= 0) {
          return {
            meses: 0,
            fechaInicio,
            fechaFinIso: null,
            fechaFinTexto: 'Sin proyección',
            totalInteresesCOP: 0,
            totalCuotasCOP: 0,
            totalAbonosCOP: 0,
            totalPagadoCOP: 0,
            warnings: [],
            amortiza: true,
            abonoConstanteUVRAproximado: 0
          };
        }

        const abonoSeguro = Math.max(0, Number(abonoConstanteCOP) || 0);

        if (esCreditoUVR(ob)) {
          const warnings = [];
          const contexto = obtenerContextoUVR(ob, warnings);
          const simulacion = simularPlanPagosConstantesUVR({
            saldoInicialUVR: Number(ob.saldoActual || 0),
            tasaEARealDec: parsePctToDec(ob.interesEA),
            cuotaUVR: Number(ob.valorCuota || 0),
            abonoConstanteCOP: abonoSeguro,
            inflacionEsperadaEA: contexto.inflacionEsperadaEA,
            valorUVRBase: contexto.valorUVRBase,
            fechaUVRBase: contexto.fechaUVRBase,
            fechaInicio
          });
          const fechaFinIso = simulacion.amortiza && simulacion.meses > 0
            ? addMonthsIso(fechaInicio, Math.max(0, simulacion.meses - 1))
            : null;
          return {
            ...simulacion,
            fechaInicio,
            fechaFinIso,
            fechaFinTexto: fechaFinIso ? formatearFechaProyeccion(fechaFinIso) : 'Sin proyección',
            warnings: [...warnings, ...(simulacion.warnings || [])]
          };
        }

        const simulacion = simularPlanPagosConstantesCOP({
          saldoInicial: Number(ob.saldoActual || 0),
          em: eaToEm(parsePctToDec(ob.interesEA)),
          valorCuota: Number(ob.valorCuota || 0),
          abonoConstanteCOP: abonoSeguro
        });
        const fechaFinIso = simulacion.amortiza && simulacion.meses > 0
          ? addMonthsIso(fechaInicio, Math.max(0, simulacion.meses - 1))
          : null;

        return {
          ...simulacion,
          fechaInicio,
          fechaFinIso,
          fechaFinTexto: fechaFinIso ? formatearFechaProyeccion(fechaFinIso) : 'Sin proyección',
          abonoConstanteUVRAproximado: 0
        };
      }

      function compararEscenariosAbonoConstante(ob, abonoConstanteCOP = 0) {
        const abonoSeguro = Math.max(0, Number(abonoConstanteCOP) || 0);
        const simulacionBase = simularEscenarioConstanteObligacion(ob, 0);
        const simulacionConAbonos = simularEscenarioConstanteObligacion(ob, abonoSeguro);
        const ahorroTotal = Math.max(0, roundTo(simulacionBase.totalPagadoCOP - simulacionConAbonos.totalPagadoCOP, 2));
        const reduccionIntereses = Math.max(0, roundTo(simulacionBase.totalInteresesCOP - simulacionConAbonos.totalInteresesCOP, 2));
        const mesesReducidos = Math.max(0, Math.round((simulacionBase.meses || 0) - (simulacionConAbonos.meses || 0)));

        return {
          abonoConstanteCOP: abonoSeguro,
          simulacionBase,
          simulacionConAbonos,
          ahorroTotal,
          reduccionIntereses,
          mesesReducidos,
          tiempoReducidoTexto: formatearDuracionMeses(mesesReducidos),
          warnings: [...new Set([...(simulacionBase.warnings || []), ...(simulacionConAbonos.warnings || [])])]
        };
      }

      /* ========= CÁLCULO DE PAGO DEL PERIODO Y ABONO APLICADO ========= */
      function calcularPagoPeriodoYAbono(ob, montoAbonoCOP, modoRecalculo) {
        const ea = parsePctToDec(ob.interesEA);
        const em = eaToEm(ea);
        const montoAbonoCOPSeguro = Math.max(0, Number(montoAbonoCOP) || 0);
        const cuotaActualizada = Math.min((ob.numeroCuota || 0) + 1, Math.max(1, ob.cantidadCuotas || 1));

        if (esCreditoUVR(ob)) {
          const warnings = [];
          const contexto = obtenerContextoUVR(ob, warnings);
          const saldoActualUVR = Number(ob.saldoActual || 0);
          const cuotaUVR = Number(ob.valorCuota || 0);
          const fechaOperacion = hoyISO();
          const fechaProximaCuota = addMonthsIso(fechaOperacion, 1);
          const uvrOperacion = obtenerUVRProyectadaObligacion(ob, fechaOperacion, warnings);
          const interesPeriodoUVR = saldoActualUVR * em;
          const cuotaPagadaUVR = Math.min(cuotaUVR, saldoActualUVR + interesPeriodoUVR);
          const amortizacionCuotaUVR = Math.max(0, cuotaPagadaUVR - interesPeriodoUVR);
          const saldoTrasCuotaUVR = Math.max(0, saldoActualUVR - amortizacionCuotaUVR);

          let montoAbonoUVR = montoAbonoCOPSeguro > 0 ? copToUvr(montoAbonoCOPSeguro, uvrOperacion) : 0;
          if (montoAbonoUVR > saldoTrasCuotaUVR) {
            pushWarning(warnings, 'El abono supera el saldo despues de la cuota. Se aplico solo el saldo restante.');
            montoAbonoUVR = saldoTrasCuotaUVR;
          }

          const saldoTrasAbonoUVR = Math.max(0, saldoTrasCuotaUVR - montoAbonoUVR);

          const baseFutura = simularPlanPagosUVR({
            saldoInicialUVR: saldoTrasCuotaUVR,
            tasaEARealDec: ea,
            cuotaUVR,
            inflacionEsperadaEA: contexto.inflacionEsperadaEA,
            valorUVRBase: contexto.valorUVRBase,
            fechaUVRBase: contexto.fechaUVRBase,
            fechaInicio: fechaProximaCuota
          });

          let nuevaCuotaUVR = cuotaUVR;
          let conAbono;
          let nuevoPlazo = baseFutura.meses;

          if (modoRecalculo === 'mantener_plazo') {
            nuevaCuotaUVR = saldoTrasAbonoUVR > 0 && baseFutura.meses > 0
              ? calcularCuotaFijaUVR(saldoTrasAbonoUVR, ea, baseFutura.meses)
              : 0;
            conAbono = simularPlanPagosUVR({
              saldoInicialUVR: saldoTrasAbonoUVR,
              tasaEARealDec: ea,
              cuotaUVR: nuevaCuotaUVR,
              inflacionEsperadaEA: contexto.inflacionEsperadaEA,
              valorUVRBase: contexto.valorUVRBase,
              fechaUVRBase: contexto.fechaUVRBase,
              fechaInicio: fechaProximaCuota
            });
            nuevoPlazo = baseFutura.meses;
          } else {
            conAbono = simularPlanPagosUVR({
              saldoInicialUVR: saldoTrasAbonoUVR,
              tasaEARealDec: ea,
              cuotaUVR,
              inflacionEsperadaEA: contexto.inflacionEsperadaEA,
              valorUVRBase: contexto.valorUVRBase,
              fechaUVRBase: contexto.fechaUVRBase,
              fechaInicio: fechaProximaCuota
            });
            nuevoPlazo = conAbono.meses;
            if (saldoTrasAbonoUVR > 0 && saldoTrasAbonoUVR < nuevaCuotaUVR) {
              nuevaCuotaUVR = saldoTrasAbonoUVR;
            }
          }

          warnings.push(...baseFutura.warnings, ...conAbono.warnings);

          const ahorroInteresesUVR = Math.max(0, baseFutura.totalInteresesUVR - conAbono.totalInteresesUVR);
          const ahorroInteresesCOPReales = roundTo(uvrToCop(ahorroInteresesUVR, uvrOperacion), 2);
          const ahorroInteresesCOPNominales = Math.max(0, baseFutura.totalInteresesCOPNominales - conAbono.totalInteresesCOPNominales);
          const mesesAhorrados = modoRecalculo === 'mantener_plazo' ? 0 : Math.max(0, baseFutura.meses - conAbono.meses);
          const uvrSiguiente = proyectarUVRPorInflacion(
            contexto.valorUVRBase,
            contexto.inflacionEsperadaDec,
            contexto.fechaUVRBase,
            fechaProximaCuota
          );

          return {
            moneda: 'UVR',
            uvrOperacion,
            warnings,
            interesPeriodo: roundTo(interesPeriodoUVR, 8),
            interesPeriodoCOP: roundTo(uvrToCop(interesPeriodoUVR, uvrOperacion), 2),
            amortizacionCuota: roundTo(amortizacionCuotaUVR, 8),
            amortizacionCuotaCOP: roundTo(uvrToCop(amortizacionCuotaUVR, uvrOperacion), 2),
            cuotaPagadaUVR: roundTo(cuotaPagadaUVR, 8),
            cuotaPagadaCOP: roundTo(uvrToCop(cuotaPagadaUVR, uvrOperacion), 2),
            montoAbonoUVR: roundTo(montoAbonoUVR, 8),
            montoAbonoCOPReal: roundTo(uvrToCop(montoAbonoUVR, uvrOperacion), 2),
            saldoTrasCuota: roundTo(saldoTrasCuotaUVR, 8),
            saldoTrasCuotaCOP: roundTo(uvrToCop(saldoTrasCuotaUVR, uvrOperacion), 2),
            saldoTrasAbono: roundTo(saldoTrasAbonoUVR, 8),
            saldoTrasAbonoCOP: roundTo(uvrToCop(saldoTrasAbonoUVR, uvrOperacion), 2),
            ahorroIntereses: roundTo(ahorroInteresesUVR, 8),
            ahorroInteresesCOPReales,
            ahorroInteresesCOPNominales: roundTo(ahorroInteresesCOPNominales, 2),
            mesesAhorrados,
            nuevaCuota: roundTo(nuevaCuotaUVR, 8),
            nuevaCuotaCOP: roundTo(uvrToCop(nuevaCuotaUVR, uvrSiguiente), 2),
            nuevoPlazo,
            valorUvrSiguiente: roundTo(uvrSiguiente, 8),
            cuotaActualizada
          };
        }

        const saldoActual = Number(ob.saldoActual || 0);
        const valorCuota = Number(ob.valorCuota || 0);
        const interesPeriodo = saldoActual * em;
        const pagoCuotaNormal = Math.min(valorCuota, saldoActual + interesPeriodo);
        const amortizacionCuota = Math.max(0, pagoCuotaNormal - interesPeriodo);
        const saldoTrasCuota = Math.max(0, saldoActual - amortizacionCuota);
        const montoAbonoAplicado = Math.min(montoAbonoCOPSeguro, saldoTrasCuota);
        const saldoTrasAbono = Math.max(0, saldoTrasCuota - montoAbonoAplicado);
        
        // SIMULAR ESCENARIO ORIGINAL (sin abono)
        const base = simularIntereses(saldoTrasCuota, em, valorCuota, UVR_CONFIG.MAX_SIMULATION_MONTHS, ob.moneda);
        
        let nuevaCuota = valorCuota;
        let conAbono;
        let nuevoPlazo = base.meses;
        const warnings = [];

        if (montoAbonoCOPSeguro > montoAbonoAplicado) {
          pushWarning(warnings, 'El abono supera el saldo despues de la cuota. Se aplico solo el saldo restante.');
        }

        if (modoRecalculo === 'mantener_plazo') {
          // Mantener plazo: recalcular cuota para liquidar en el plazo original
          nuevaCuota = saldoTrasAbono > 0 && base.meses > 0
            ? roundTo(calcularCuotaNivelada(saldoTrasAbono, em, base.meses), 2)
            : 0;
          conAbono = simularIntereses(saldoTrasAbono, em, nuevaCuota, UVR_CONFIG.MAX_SIMULATION_MONTHS, ob.moneda);
          nuevoPlazo = base.meses; // El plazo se mantiene igual
        } else {
          // Mantener cuota: simular con la misma cuota, reduciendo plazo
          conAbono = simularIntereses(saldoTrasAbono, em, valorCuota, UVR_CONFIG.MAX_SIMULATION_MONTHS, ob.moneda);
          nuevoPlazo = conAbono.meses;
          // Si el saldo es menor que la cuota original, ajustar la cuota
          if (saldoTrasAbono > 0 && saldoTrasAbono < nuevaCuota && saldoTrasAbono < valorCuota) {
            nuevaCuota = saldoTrasAbono;
          }
        }

        const ahorro = Math.max(0, base.interesesAcum - conAbono.interesesAcum);
        // CORRECCIÓN: Calcular meses ahorrados correctamente
        const mesesAhorrados = modoRecalculo === 'mantener_plazo' ? 0 : Math.max(0, base.meses - conAbono.meses);

        return {
          moneda: ob.moneda,
          warnings,
          interesPeriodo,
          interesPeriodoCOP: interesPeriodo,
          amortizacionCuota,
          amortizacionCuotaCOP: amortizacionCuota,
          cuotaPagadaUVR: 0,
          cuotaPagadaCOP: pagoCuotaNormal,
          montoAbonoUVR: 0,
          montoAbonoCOPReal: montoAbonoAplicado,
          saldoTrasCuota,
          saldoTrasCuotaCOP: saldoTrasCuota,
          saldoTrasAbono,
          saldoTrasAbonoCOP: saldoTrasAbono,
          ahorroIntereses: ahorro,
          ahorroInteresesCOPReales: ahorro,
          ahorroInteresesCOPNominales: ahorro,
          mesesAhorrados,
          nuevaCuota,
          nuevaCuotaCOP: nuevaCuota,
          nuevoPlazo,
          valorUvrSiguiente: uvrActual,
          cuotaActualizada
        };
      }

      function calcularAbonoSoloCapital(ob, montoAbonoCOP, modoRecalculo) {
        const ea = parsePctToDec(ob.interesEA);
        const em = eaToEm(ea);
        const montoAbonoCOPSeguro = Math.max(0, Number(montoAbonoCOP) || 0);
        const cuotaActualizada = Math.max(1, Number(ob.numeroCuota || 1));
        const fechaProximaCuota = obtenerFechaInicioProyeccionObligacion(ob);

        if (esCreditoUVR(ob)) {
          const warnings = [];
          const contexto = obtenerContextoUVR(ob, warnings);
          const saldoActualUVR = Number(ob.saldoActual || 0);
          const cuotaUVR = Number(ob.valorCuota || 0);
          const fechaOperacion = hoyISO();
          const uvrOperacion = obtenerUVRProyectadaObligacion(ob, fechaOperacion, warnings);

          let montoAbonoUVR = montoAbonoCOPSeguro > 0 ? copToUvr(montoAbonoCOPSeguro, uvrOperacion) : 0;
          if (montoAbonoUVR > saldoActualUVR) {
            pushWarning(warnings, 'El abono supera el saldo actual. Se aplico solo el saldo restante.');
            montoAbonoUVR = saldoActualUVR;
          }

          const saldoTrasAbonoUVR = Math.max(0, saldoActualUVR - montoAbonoUVR);
          const baseFutura = simularPlanPagosUVR({
            saldoInicialUVR: saldoActualUVR,
            tasaEARealDec: ea,
            cuotaUVR,
            inflacionEsperadaEA: contexto.inflacionEsperadaEA,
            valorUVRBase: contexto.valorUVRBase,
            fechaUVRBase: contexto.fechaUVRBase,
            fechaInicio: fechaProximaCuota
          });

          let nuevaCuotaUVR = cuotaUVR;
          let conAbono;
          let nuevoPlazo = baseFutura.meses;

          if (modoRecalculo === 'mantener_plazo') {
            nuevaCuotaUVR = saldoTrasAbonoUVR > 0 && baseFutura.meses > 0
              ? calcularCuotaFijaUVR(saldoTrasAbonoUVR, ea, baseFutura.meses)
              : 0;
            conAbono = simularPlanPagosUVR({
              saldoInicialUVR: saldoTrasAbonoUVR,
              tasaEARealDec: ea,
              cuotaUVR: nuevaCuotaUVR,
              inflacionEsperadaEA: contexto.inflacionEsperadaEA,
              valorUVRBase: contexto.valorUVRBase,
              fechaUVRBase: contexto.fechaUVRBase,
              fechaInicio: fechaProximaCuota
            });
            nuevoPlazo = baseFutura.meses;
          } else {
            conAbono = simularPlanPagosUVR({
              saldoInicialUVR: saldoTrasAbonoUVR,
              tasaEARealDec: ea,
              cuotaUVR,
              inflacionEsperadaEA: contexto.inflacionEsperadaEA,
              valorUVRBase: contexto.valorUVRBase,
              fechaUVRBase: contexto.fechaUVRBase,
              fechaInicio: fechaProximaCuota
            });
            nuevoPlazo = conAbono.meses;
            if (saldoTrasAbonoUVR > 0 && saldoTrasAbonoUVR < nuevaCuotaUVR) {
              nuevaCuotaUVR = saldoTrasAbonoUVR;
            }
          }

          warnings.push(...baseFutura.warnings, ...conAbono.warnings);

          const ahorroInteresesUVR = Math.max(0, baseFutura.totalInteresesUVR - conAbono.totalInteresesUVR);
          const ahorroInteresesCOPReales = roundTo(uvrToCop(ahorroInteresesUVR, uvrOperacion), 2);
          const ahorroInteresesCOPNominales = Math.max(0, baseFutura.totalInteresesCOPNominales - conAbono.totalInteresesCOPNominales);
          const mesesAhorrados = modoRecalculo === 'mantener_plazo' ? 0 : Math.max(0, baseFutura.meses - conAbono.meses);
          const uvrSiguiente = proyectarUVRPorInflacion(
            contexto.valorUVRBase,
            contexto.inflacionEsperadaDec,
            contexto.fechaUVRBase,
            fechaProximaCuota
          );

          return {
            moneda: 'UVR',
            tipoMovimiento: TIPOS_MOVIMIENTO.ABONO_CAPITAL,
            uvrOperacion,
            warnings,
            interesPeriodo: 0,
            interesPeriodoCOP: 0,
            amortizacionCuota: 0,
            amortizacionCuotaCOP: 0,
            cuotaPagadaUVR: 0,
            cuotaPagadaCOP: 0,
            montoAbonoUVR: roundTo(montoAbonoUVR, 8),
            montoAbonoCOPReal: roundTo(uvrToCop(montoAbonoUVR, uvrOperacion), 2),
            saldoTrasCuota: roundTo(saldoActualUVR, 8),
            saldoTrasCuotaCOP: roundTo(uvrToCop(saldoActualUVR, uvrOperacion), 2),
            saldoTrasAbono: roundTo(saldoTrasAbonoUVR, 8),
            saldoTrasAbonoCOP: roundTo(uvrToCop(saldoTrasAbonoUVR, uvrOperacion), 2),
            ahorroIntereses: roundTo(ahorroInteresesUVR, 8),
            ahorroInteresesCOPReales,
            ahorroInteresesCOPNominales: roundTo(ahorroInteresesCOPNominales, 2),
            mesesAhorrados,
            nuevaCuota: roundTo(nuevaCuotaUVR, 8),
            nuevaCuotaCOP: roundTo(uvrToCop(nuevaCuotaUVR, uvrSiguiente), 2),
            nuevoPlazo,
            valorUvrSiguiente: roundTo(uvrSiguiente, 8),
            cuotaActualizada
          };
        }

        const saldoActual = Number(ob.saldoActual || 0);
        const valorCuota = Number(ob.valorCuota || 0);
        const montoAbonoAplicado = Math.min(montoAbonoCOPSeguro, saldoActual);
        const saldoTrasAbono = Math.max(0, saldoActual - montoAbonoAplicado);
        const base = simularIntereses(saldoActual, em, valorCuota, UVR_CONFIG.MAX_SIMULATION_MONTHS, ob.moneda);

        let nuevaCuota = valorCuota;
        let conAbono;
        let nuevoPlazo = base.meses;
        const warnings = [];

        if (montoAbonoCOPSeguro > montoAbonoAplicado) {
          pushWarning(warnings, 'El abono supera el saldo actual. Se aplico solo el saldo restante.');
        }

        if (modoRecalculo === 'mantener_plazo') {
          nuevaCuota = saldoTrasAbono > 0 && base.meses > 0
            ? roundTo(calcularCuotaNivelada(saldoTrasAbono, em, base.meses), 2)
            : 0;
          conAbono = simularIntereses(saldoTrasAbono, em, nuevaCuota, UVR_CONFIG.MAX_SIMULATION_MONTHS, ob.moneda);
          nuevoPlazo = base.meses;
        } else {
          conAbono = simularIntereses(saldoTrasAbono, em, valorCuota, UVR_CONFIG.MAX_SIMULATION_MONTHS, ob.moneda);
          nuevoPlazo = conAbono.meses;
          if (saldoTrasAbono > 0 && saldoTrasAbono < nuevaCuota && saldoTrasAbono < valorCuota) {
            nuevaCuota = saldoTrasAbono;
          }
        }

        const ahorro = Math.max(0, base.interesesAcum - conAbono.interesesAcum);
        const mesesAhorrados = modoRecalculo === 'mantener_plazo' ? 0 : Math.max(0, base.meses - conAbono.meses);

        return {
          moneda: ob.moneda,
          tipoMovimiento: TIPOS_MOVIMIENTO.ABONO_CAPITAL,
          warnings,
          interesPeriodo: 0,
          interesPeriodoCOP: 0,
          amortizacionCuota: 0,
          amortizacionCuotaCOP: 0,
          cuotaPagadaUVR: 0,
          cuotaPagadaCOP: 0,
          montoAbonoUVR: 0,
          montoAbonoCOPReal: montoAbonoAplicado,
          saldoTrasCuota: saldoActual,
          saldoTrasCuotaCOP: saldoActual,
          saldoTrasAbono,
          saldoTrasAbonoCOP: saldoTrasAbono,
          ahorroIntereses: ahorro,
          ahorroInteresesCOPReales: ahorro,
          ahorroInteresesCOPNominales: ahorro,
          mesesAhorrados,
          nuevaCuota,
          nuevaCuotaCOP: nuevaCuota,
          nuevoPlazo,
          valorUvrSiguiente: uvrActual,
          cuotaActualizada
        };
      }

      /* ========= MÉTRICAS ========= */
      function calcularMetricasGlobales() {
        const activas = obligaciones.filter(ob => ob.saldoActual > 0);
        const saldoTotalCOP = activas.reduce((sum, ob) => {
          return sum + (esCreditoUVR(ob) ? obtenerSaldoActualCOP(ob) : Number(ob.saldoActual || 0));
        }, 0);

        const metricasActivas = obligaciones.reduce((acc, ob) => {
          const metricas = obtenerMetricasObligacionActiva(ob);
          acc.intereses += metricas.intereses;
          acc.capital += metricas.capital;
          acc.cuotas += metricas.cuotas;
          return acc;
        }, { intereses: 0, capital: 0, cuotas: 0 });

        const metricasCerradas = obligacionesCerradas.reduce((acc, cerrada) => {
          const metricas = obtenerMetricasObligacionCerrada(cerrada);
          acc.intereses += metricas.intereses;
          acc.capital += metricas.capital;
          acc.cuotas += metricas.cuotas;
          return acc;
        }, { intereses: 0, capital: 0, cuotas: 0 });

        return {
          saldoTotal: saldoTotalCOP,
          interesesTotales: metricasActivas.intereses + metricasCerradas.intereses,
          capitalTotal: metricasActivas.capital + metricasCerradas.capital,
          cuotasTotales: metricasActivas.cuotas + metricasCerradas.cuotas
        };
      }

      function actualizarDashboard() {
        const m = calcularMetricasGlobales();
        byId('totalSaldoPendiente').textContent = fmtCOP(m.saldoTotal);
        byId('totalInteresesAhorrados').textContent = fmtCOP(m.interesesTotales);
        byId('totalCapitalAmortizado').textContent = fmtCOP(m.capitalTotal);
        byId('totalCuotasEvitadas').textContent = m.cuotasTotales;
        renderizarAjusteDashboard();
        actualizarProyeccionLibertad();
      }

      /* ========= LIBERTAD FINANCIERA ========= */
      function calcularProgresoDeudaCero() {
        const saldoActualCOP = obligaciones
          .filter((ob) => Number(ob?.saldoActual || 0) > 0)
          .reduce((sum, ob) => sum + (esCreditoUVR(ob) ? obtenerSaldoActualCOP(ob) : Number(ob.saldoActual || 0)), 0);
        const baseActivasCOP = obligaciones.reduce((sum, ob) => {
          return sum + Math.max(
            esCreditoUVR(ob) ? obtenerValorCreditoBaseCOP(ob) : Number(ob.valorCredito || 0),
            esCreditoUVR(ob) ? obtenerSaldoActualCOP(ob) : Number(ob.saldoActual || 0)
          );
        }, 0);
        const baseCerradasCOP = obligacionesCerradas.reduce((sum, cerrada) => {
          const cerradaNormalizada = normalizarObligacionCerrada(cerrada);
          return sum + Number(cerradaNormalizada?.valorCreditoOriginalCOP || 0);
        }, 0);
        const baseTotalCOP = baseActivasCOP + baseCerradasCOP;

        if (baseTotalCOP <= 0) {
          return obligacionesCerradas.length > 0 ? 100 : 0;
        }

        const progreso = ((baseTotalCOP - saldoActualCOP) / baseTotalCOP) * 100;
        return Math.min(100, Math.max(0, progreso));
      }

      function obtenerFechaInicioProyeccionObligacion(ob) {
        return toIsoDate(ob?.fechaProximoVencimiento || addMonthsIso(hoyISO(), 1), addMonthsIso(hoyISO(), 1));
      }

      function obtenerCuotaMensualCOPObligacion(ob, fechaReferencia = hoyISO()) {
        if (!esCreditoUVR(ob)) return Number(ob?.valorCuota || 0);
        return roundTo(uvrToCop(Number(ob?.valorCuota || 0), obtenerUVRProyectadaObligacion(ob, fechaReferencia)), 2);
      }

      function formatearFechaProyeccion(fecha) {
        const date = parseStoredDate(fecha);
        if (!date) return 'Sin fecha';
        return date.toLocaleDateString('es-CO', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });
      }

      function proyectarFinObligacion(ob) {
        if (!ob || Number(ob?.saldoActual || 0) <= 0) return null;

        const fechaInicio = obtenerFechaInicioProyeccionObligacion(ob);
        const saldoActualCOP = esCreditoUVR(ob) ? obtenerSaldoActualCOP(ob) : Number(ob.saldoActual || 0);
        const cuotaMensualCOP = obtenerCuotaMensualCOPObligacion(ob, fechaInicio);
        const abonosHistoricos = ob?.historicoAbonos || [];
        const em = eaToEm(parsePctToDec(ob.interesEA));

        let mesesRestantes = 0;
        let fechaFinIso = null;
        let esProyectable = false;
        let warnings = [];

        if (esCreditoUVR(ob)) {
          const contexto = obtenerContextoUVR(ob, warnings);
          const simulacionUVR = simularPlanPagosUVR({
            saldoInicialUVR: Number(ob.saldoActual || 0),
            tasaEARealDec: parsePctToDec(ob.interesEA),
            cuotaUVR: Number(ob.valorCuota || 0),
            inflacionEsperadaEA: contexto.inflacionEsperadaEA,
            valorUVRBase: contexto.valorUVRBase,
            fechaUVRBase: contexto.fechaUVRBase,
            fechaInicio
          });

          mesesRestantes = simulacionUVR.meses;
          esProyectable = Boolean(simulacionUVR.amortiza) && Number(simulacionUVR.saldoFinalUVR || 0) <= UVR_CONFIG.EPSILON_UVR && mesesRestantes > 0;
          warnings = [...warnings, ...(simulacionUVR.warnings || [])];
        } else {
          const simulacionCOP = simularIntereses(
            Number(ob.saldoActual || 0),
            em,
            Number(ob.valorCuota || 0),
            UVR_CONFIG.MAX_SIMULATION_MONTHS,
            ob.moneda
          );

          mesesRestantes = simulacionCOP.meses;
          esProyectable = Number(simulacionCOP.saldoFinal || 0) <= 0.01 && mesesRestantes > 0;
        }

        if (esProyectable) {
          fechaFinIso = addMonthsIso(fechaInicio, Math.max(0, mesesRestantes - 1));
        }

        return {
          id: ob.id,
          entidad: ob.entidad,
          tipoCredito: ob.tipoCredito,
          moneda: ob.moneda || 'COP',
          fechaInicio,
          fechaFinIso,
          fechaFin: fechaFinIso ? parseStoredDate(fechaFinIso) : null,
          fechaFinTexto: fechaFinIso ? formatearFechaProyeccion(fechaFinIso) : 'Sin proyección',
          mesesRestantes,
          saldoActualCOP,
          cuotaMensualCOP,
          numeroAbonos: contarMovimientosCapital(ob, abonosHistoricos),
          esProyectable,
          warnings
        };
      }

      function obtenerProyeccionesLibertad() {
        return obligaciones
          .filter((ob) => Number(ob?.saldoActual || 0) > 0)
          .map((ob) => proyectarFinObligacion(ob))
          .filter(Boolean);
      }

      function obtenerReferenciaLibertad(proyecciones) {
        if (!proyecciones.length) return null;

        const noProyectables = proyecciones.filter((proyeccion) => !proyeccion.esProyectable);
        if (noProyectables.length > 0) {
          return noProyectables.sort((a, b) => b.saldoActualCOP - a.saldoActualCOP)[0];
        }

        return proyecciones.reduce((referencia, actual) => {
          if (!referencia) return actual;
          if (!referencia.fechaFin) return actual;
          if (!actual.fechaFin) return referencia;
          return actual.fechaFin > referencia.fechaFin ? actual : referencia;
        }, null);
      }

      function calcularFechaLibertad() {
        const activas = obligaciones.filter(ob => ob.saldoActual > 0);
        const progresoGlobal = calcularProgresoDeudaCero();
        
        if (activas.length === 0) {
          return { 
            fecha: '--', 
            progreso: obligacionesCerradas.length > 0 ? 100 : 0, 
            esLibre: false,
            mensajeDetalle: '💰 Sin deudas activas'
          };
        }

        const proyecciones = obtenerProyeccionesLibertad();
        const referencia = obtenerReferenciaLibertad(proyecciones);
        const saldoTotalCOP = activas.reduce((sum, ob) => {
          return sum + (esCreditoUVR(ob) ? obtenerSaldoActualCOP(ob) : Number(ob.saldoActual || 0));
        }, 0);

        if (!referencia) {
          return {
            fecha: 'Sin datos',
            progreso: progresoGlobal,
            esLibre: false,
            mensajeDetalle: `💰 ${fmtCOP(saldoTotalCOP)} · ${activas.length} deuda(s)`
          };
        }

        if (!referencia.esProyectable) {
          return {
            fecha: 'Sin proyección',
            progreso: progresoGlobal,
            esLibre: false,
            mensajeDetalle: `💰 ${referencia.entidad} requiere una cuota que amortice capital`
          };
        }

        const detalleObligaciones = proyecciones.length === 1
          ? `${referencia.entidad} · ${referencia.mesesRestantes} cuota(s) restantes`
          : `${referencia.entidad} marca la fecha objetivo · ${referencia.mesesRestantes} cuota(s) restantes`;

        return {
          fecha: referencia.fechaFinTexto,
          progreso: progresoGlobal,
          esLibre: false,
          mensajeDetalle: `💰 ${detalleObligaciones} · ${fmtCOP(saldoTotalCOP)} pendiente`
        };
      }

      function actualizarProyeccionLibertad() {
        const p = calcularFechaLibertad();
        const activas = obligaciones.filter(ob => ob.saldoActual > 0);
        
        byId('fechaLibertad').textContent = p.fecha;
        byId('progresoLibertad').style.width = `${p.progreso}%`;
        byId('porcentajeLibertad').textContent = `${Math.round(p.progreso)}%`;
        byId('detalleLibertad').innerHTML = p.mensajeDetalle || `💰 ${activas.length} deuda(s)`;
        
        const libertadCard = byId('libertadCard');
        if (activas.length === 0 && obligacionesCerradas.length > 0) {
          libertadCard.classList.add('card-especial');
          lanzarConfeti(100);
        } else {
          libertadCard.classList.remove('card-especial');
        }
      }

      /* ========= GRÁFICO ========= */
      function renderizarGrafico() {
        const ctx = document.getElementById('graficoDeuda').getContext('2d');
        const puntos = [];
        
        if (obligaciones.length > 0) {
          const saldoInicial = obligaciones.reduce((sum, ob) => {
            return sum + (esCreditoUVR(ob) ? obtenerSaldoActualCOP({ ...ob, saldoActual: Number(ob.valorCredito || 0) }) : Number(ob.valorCredito || 0));
          }, 0);
          puntos.push({ fecha: new Date(obligaciones[0].creadoAt || Date.now()), saldo: saldoInicial });

          obligaciones.forEach(ob => {
            if (ob.historicoAbonos) {
              ob.historicoAbonos.forEach(a => {
                if (a.fecha) {
                  let saldo = esCreditoUVR(ob)
                    ? Number(a.saldoPosteriorCOP || 0)
                    : Number(a.saldoPosterior || 0);
                  const fechaAbono = parseStoredDate(a.fechaRegistro || a.fecha);
                  if (fechaAbono) {
                    puntos.push({ fecha: fechaAbono, saldo });
                  }
                }
              });
            }
          });
        }

        puntos.sort((a, b) => a.fecha - b.fecha);

        if (graficoInstance) graficoInstance.destroy();
        
        if (puntos.length > 0) {
          graficoInstance = new Chart(ctx, {
            type: 'line',
            data: {
              labels: puntos.map(p => formatDateDisplay(p.fecha)),
              datasets: [{
                label: 'Deuda total (COP)',
                data: puntos.map(p => p.saldo),
                borderColor: '#00A86B',
                backgroundColor: 'rgba(0,168,107,0.1)',
                tension: 0.4,
                fill: true
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                tooltip: { 
                  callbacks: { 
                    label: (ctx) => fmtCOP(ctx.raw) 
                  } 
                }
              }
            }
          });
        } else {
          graficoInstance = new Chart(ctx, {
            type: 'line',
            data: {
              labels: ['Sin datos'],
              datasets: [{
                label: 'Deuda total',
                data: [0],
                borderColor: '#00A86B',
                backgroundColor: 'rgba(0,168,107,0.1)'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false
            }
          });
        }
      }

      const GRAFICO_SERIES_TOP = [
        { color: '#1B4F85', fill: 'rgba(27, 79, 133, 0.12)', dash: [] },
        { color: '#E85D4F', fill: 'rgba(232, 93, 79, 0.12)', dash: [10, 6] },
        { color: '#C98718', fill: 'rgba(201, 135, 24, 0.12)', dash: [3, 6] }
      ];

      function prioridadEventoGrafico(tipoEvento) {
        const prioridad = {
          creacion: 0,
          abono: 1,
          cierre: 2,
          continuidad: 3
        };
        return prioridad[tipoEvento] ?? 99;
      }

      function fmtCOPCompacto(value) {
        const amount = Number(value) || 0;
        const abs = Math.abs(amount);
        const sign = amount < 0 ? '-' : '';

        if (abs >= 1000000) {
          const digits = abs >= 10000000 ? 0 : 1;
          return `${sign}$${(abs / 1000000).toLocaleString('es-CO', { maximumFractionDigits: digits })} M`;
        }

        if (abs >= 1000) {
          const digits = abs >= 10000 ? 0 : 1;
          return `${sign}$${(abs / 1000).toLocaleString('es-CO', { maximumFractionDigits: digits })} mil`;
        }

        return fmtCOP(amount);
      }

      function formatearFechaGraficoEje(timestamp, rangoMs = 0) {
        const fecha = new Date(Number(timestamp));
        if (Number.isNaN(fecha.getTime())) return '';

        if (vistaGraficoActual === 'mensual' || rangoMs > (365 * DAY_IN_MS)) {
          return fecha.toLocaleDateString('es-CO', {
            month: '2-digit',
            year: '2-digit'
          });
        }

        return fecha.toLocaleDateString('es-CO', {
          day: '2-digit',
          month: '2-digit'
        });
      }

      function formatearFechaGraficoTooltip(timestamp) {
        const fecha = new Date(Number(timestamp));
        if (Number.isNaN(fecha.getTime())) return '--/--/----';
        const fechaBase = fecha.toLocaleDateString('es-CO', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
        const tieneHora = fecha.getHours() !== 0 || fecha.getMinutes() !== 0 || fecha.getSeconds() !== 0;
        if (!tieneHora) return fechaBase;
        return `${fechaBase} ${fecha.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}`;
      }

      function normalizarTimestampGraficoPorFecha(value) {
        const fecha = parseStoredDate(value);
        if (!fecha) return null;
        return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate()).getTime();
      }

      function consolidarEventosGraficoPorFecha(eventos) {
        const eventosConsolidados = new Map();

        eventos.forEach((evento) => {
          const timestampNormalizado = normalizarTimestampGraficoPorFecha(evento.x);
          if (!Number.isFinite(timestampNormalizado)) return;

          const actual = eventosConsolidados.get(timestampNormalizado) || {
            x: timestampNormalizado,
            y: Number(evento.y || 0),
            marker: false,
            eventType: 'continuidad'
          };

          actual.y = Number(evento.y || 0);
          actual.marker = actual.marker || Boolean(evento.marker) || evento.eventType === 'abono';
          actual.eventType = actual.marker ? 'abono' : evento.eventType;

          if (!actual.marker && evento.eventType === 'cierre') {
            actual.eventType = 'cierre';
          }

          eventosConsolidados.set(timestampNormalizado, actual);
        });

        return [...eventosConsolidados.values()].sort((a, b) => a.x - b.x);
      }

      function actualizarBotonesVistaGrafico() {
        document.querySelectorAll('[data-chart-view]').forEach((button) => {
          button.classList.toggle('is-active', button.dataset.chartView === vistaGraficoActual);
        });
      }

      function obtenerValorInicialCOPGrafico(ob) {
        if (!ob) return 0;
        if (esNumeroFinito(ob.valorCreditoOriginalCOP)) return Number(ob.valorCreditoOriginalCOP);
        if (esCreditoUVR(ob)) return roundTo(obtenerValorCreditoBaseCOP(ob), 2);
        return Number(ob.valorCredito || ob.saldoActual || 0);
      }

      function obtenerSaldoPosteriorCOPGrafico(ob, abono) {
        if (!abono) return 0;
        if (esNumeroFinito(abono.saldoPosteriorCOP)) return Number(abono.saldoPosteriorCOP);
        if (esCreditoUVR(ob) && esNumeroFinito(abono.saldoPosteriorUVR)) {
          const valorUvr = sanearValorUvr(abono.uvrOperacion || ob?.uvr?.valorUVRActual || ob?.uvr?.valorUVRBase || uvrActual);
          return roundTo(uvrToCop(Number(abono.saldoPosteriorUVR || 0), valorUvr), 2);
        }
        return Number(abono.saldoPosterior || 0);
      }

      function obtenerSaldoFinalCOPGrafico(ob) {
        if (!ob) return 0;
        if (esNumeroFinito(ob.saldoFinalCOP)) return Number(ob.saldoFinalCOP);
        if (esCreditoUVR(ob)) {
          const valorUvr = sanearValorUvr(ob?.uvr?.valorUVRActual || ob?.uvr?.valorUVRBase || uvrActual);
          return roundTo(uvrToCop(Number(ob.saldoFinal || 0), valorUvr), 2);
        }
        return Number(ob.saldoFinal || 0);
      }

      function construirEventosObligacionGrafico(ob, estaCerrada = false) {
        const fechaCreacion = parseStoredDate(
          ob?.creadoAt
          || ob?.fechaCreacion
          || ob?.historicoAbonos?.[0]?.fechaRegistro
          || ob?.historicoAbonos?.[0]?.fecha
          || ob?.fechaCierreISO
          || ob?.fechaCierre
        );
        if (!fechaCreacion) return [];

        const eventos = [{
          x: fechaCreacion.getTime(),
          y: roundTo(obtenerValorInicialCOPGrafico(ob), 2),
          marker: false,
          eventType: 'creacion'
        }];

        const abonos = [...(ob?.historicoAbonos || [])]
          .map((abono) => ({
            ...abono,
            __fechaEvento: parseStoredDate(abono?.fechaRegistro || abono?.fecha)
          }))
          .filter((abono) => abono.__fechaEvento)
          .sort((a, b) => a.__fechaEvento - b.__fechaEvento);

        abonos.forEach((abono) => {
          eventos.push({
            x: abono.__fechaEvento.getTime(),
            y: roundTo(obtenerSaldoPosteriorCOPGrafico(ob, abono), 2),
            marker: true,
            eventType: 'abono'
          });
        });

        const fechaCierre = estaCerrada ? parseStoredDate(ob?.fechaCierreISO || ob?.fechaCierre) : null;
        if (fechaCierre) {
          eventos.push({
            x: fechaCierre.getTime(),
            y: roundTo(obtenerSaldoFinalCOPGrafico(ob), 2),
            marker: false,
            eventType: 'cierre'
          });
        }

        const ordenados = eventos.sort((a, b) => (a.x - b.x) || (prioridadEventoGrafico(a.eventType) - prioridadEventoGrafico(b.eventType)));
        return consolidarEventosGraficoPorFecha(ordenados);
      }

      function obtenerSaldoObligacionEnFecha(eventos, timestamp) {
        let saldo = null;
        for (const evento of eventos) {
          if (evento.x > timestamp) break;
          saldo = Number(evento.y || 0);
        }
        return saldo;
      }

      function construirTimelineGrafico(eventosPorObligacion) {
        const timeline = [...new Set(
          eventosPorObligacion
            .flatMap((item) => item.eventos.map((evento) => evento.x))
            .filter((timestamp) => Number.isFinite(timestamp))
            .sort((a, b) => a - b)
        )];

        if (timeline.length === 1) {
          const ultimo = timeline[0];
          const ahora = Date.now();
          timeline.push(ahora > ultimo ? ahora : (ultimo + DAY_IN_MS));
        }

        return timeline;
      }

      function construirSerieGraficoParaTimeline(eventos, timeline) {
        return timeline.map((timestamp) => {
          const saldo = obtenerSaldoObligacionEnFecha(eventos, timestamp);
          const esAbono = eventos.some((evento) => evento.x === timestamp && evento.eventType === 'abono');
          return {
            x: timestamp,
            y: saldo === null ? null : roundTo(saldo, 2),
            marker: esAbono,
            eventType: esAbono ? 'abono' : 'continuidad'
          };
        });
      }

      function obtenerObligacionesActivasParaGrafico() {
        return obligaciones.filter((ob) => ob && !ob.cerrada);
      }

      function obtenerTopObligacionesParaGrafico() {
        return obtenerObligacionesActivasParaGrafico()
          .map((ob) => ({
            obligacion: ob,
            saldoActualCOP: obtenerSaldoActualCOP(ob)
          }))
          .sort((a, b) => b.saldoActualCOP - a.saldoActualCOP)
          .slice(0, 3);
      }

      function construirDatasetsGraficoDeuda() {
        const obligacionesHistoricas = obtenerObligacionesActivasParaGrafico()
          .map((obligacion) => ({ obligacion, estaCerrada: false }));

        const eventosPorObligacion = obligacionesHistoricas
          .map(({ obligacion, estaCerrada }) => ({
            obligacion,
            estaCerrada,
            eventos: construirEventosObligacionGrafico(obligacion, estaCerrada)
          }))
          .filter((item) => item.eventos.length > 0);

        const timeline = construirTimelineGrafico(eventosPorObligacion);
        if (!timeline.length) {
          return { datasets: [], timeline: [] };
        }

        const puntosTotal = timeline.map((timestamp) => {
          const esAbono = eventosPorObligacion.some((item) => item.eventos.some((evento) => evento.x === timestamp && evento.eventType === 'abono'));
          return {
            x: timestamp,
            y: roundTo(eventosPorObligacion.reduce((sum, item) => {
              const saldo = obtenerSaldoObligacionEnFecha(item.eventos, timestamp);
              return sum + (saldo === null ? 0 : saldo);
            }, 0), 2),
            marker: esAbono,
            eventType: esAbono ? 'abono' : 'continuidad'
          };
        });

        const datasets = [{
          label: 'Total general',
          data: puntosTotal,
          borderColor: '#009A67',
          backgroundColor: 'rgba(0, 154, 103, 0.16)',
          borderWidth: 4,
          fill: true,
          stepped: false,
          tension: 0.32,
          cubicInterpolationMode: 'monotone',
          pointRadius: (ctx) => ctx.raw?.marker ? 5 : 0,
          pointHoverRadius: (ctx) => ctx.raw?.marker ? 8 : 0,
          pointHitRadius: (ctx) => ctx.raw?.marker ? 14 : 6,
          pointBackgroundColor: '#009A67',
          pointBorderColor: '#ffffff',
          pointBorderWidth: 2.5
        }];

        const topActivas = obtenerTopObligacionesParaGrafico();
        topActivas.forEach(({ obligacion }, index) => {
          const estilo = GRAFICO_SERIES_TOP[index] || GRAFICO_SERIES_TOP[GRAFICO_SERIES_TOP.length - 1];
          const eventos = construirEventosObligacionGrafico(obligacion, false);
          const data = construirSerieGraficoParaTimeline(eventos, timeline);
          if (!data.some((point) => point.y !== null)) return;

          datasets.push({
            label: obligacion.entidad,
            data,
            borderColor: estilo.color,
            backgroundColor: estilo.fill,
            borderWidth: 3,
            fill: false,
            stepped: false,
            tension: 0.28,
            cubicInterpolationMode: 'monotone',
            borderDash: estilo.dash,
            pointRadius: (ctx) => ctx.raw?.marker ? 4.5 : 0,
            pointHoverRadius: (ctx) => ctx.raw?.marker ? 7 : 0,
            pointHitRadius: (ctx) => ctx.raw?.marker ? 14 : 6,
            pointBackgroundColor: estilo.color,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2.5,
            spanGaps: false
          });
        });

        return { datasets, timeline };
      }

      function renderizarGrafico() {
        const canvas = byId('graficoDeuda');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        actualizarBotonesVistaGrafico();
        if (graficoInstance) graficoInstance.destroy();

        const { datasets, timeline } = construirDatasetsGraficoDeuda();
        const rangoMs = timeline.length > 1 ? (timeline[timeline.length - 1] - timeline[0]) : 0;
        const ahora = Date.now();

        graficoInstance = new Chart(ctx, {
          type: 'line',
          data: {
            datasets: datasets.length > 0 ? datasets : [{
              label: 'Total general',
              data: [
                { x: ahora, y: 0, marker: false, eventType: 'continuidad' },
                { x: ahora + DAY_IN_MS, y: 0, marker: false, eventType: 'continuidad' }
              ],
              borderColor: '#CBD5E1',
              backgroundColor: 'rgba(203, 213, 225, 0.12)',
              borderWidth: 2,
              fill: true,
              stepped: false,
              tension: 0.25,
              cubicInterpolationMode: 'monotone',
              pointRadius: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
              mode: 'nearest',
              intersect: false
            },
            scales: {
              x: {
                type: 'linear',
                grid: {
                  display: false,
                  drawBorder: false
                },
                ticks: {
                  autoSkip: true,
                  maxTicksLimit: vistaGraficoActual === 'mensual' ? 6 : 8,
                  color: '#5B7088',
                  padding: 8,
                  callback: (value) => formatearFechaGraficoEje(value, rangoMs)
                }
              },
              y: {
                beginAtZero: true,
                grid: {
                  color: 'rgba(31, 78, 121, 0.10)',
                  drawBorder: false
                },
                ticks: {
                  color: '#5B7088',
                  padding: 8,
                  callback: (value) => fmtCOPCompacto(value)
                }
              }
            },
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  usePointStyle: true,
                  pointStyle: 'line',
                  padding: 16,
                  color: '#1F2937'
                }
              },
              tooltip: {
                backgroundColor: 'rgba(17, 24, 39, 0.92)',
                titleColor: '#F8FAFC',
                bodyColor: '#F8FAFC',
                borderColor: 'rgba(255, 255, 255, 0.12)',
                borderWidth: 1,
                padding: 12,
                displayColors: true,
                callbacks: {
                  title: (items) => formatearFechaGraficoTooltip(items?.[0]?.raw?.x ?? items?.[0]?.parsed?.x),
                  label: (context) => `${context.dataset.label}: ${fmtCOP(context.parsed.y)}`
                }
              }
            }
          }
        });
      }

      const GRAFICO_MAX_TOTAL_POINTS = 500;
      const GRAFICO_MAX_AXIS_LABELS = 30;

      function formatearFechaGraficoContinuo(timestamp, rangoMs = 0) {
        const fecha = new Date(Number(timestamp));
        if (Number.isNaN(fecha.getTime())) return '';
        const vistaMensual = vistaGraficoActual === 'mensual' || rangoMs > (180 * DAY_IN_MS);
        return fecha.toLocaleDateString('es-CO', vistaMensual
          ? { month: 'numeric', year: '2-digit' }
          : { day: 'numeric', month: 'numeric' });
      }

      function limpiarSerieGraficoContinuo(puntos = []) {
        const consolidados = consolidarEventosGraficoPorFecha(puntos);
        return consolidados.reduce((serieLimpia, punto) => {
          const actual = {
            x: Number(punto.x),
            y: roundTo(Number(punto.y || 0), 2),
            marker: Boolean(punto.marker),
            eventType: punto.eventType || 'continuidad'
          };

          if (!serieLimpia.length) {
            serieLimpia.push(actual);
            return serieLimpia;
          }

          const previo = serieLimpia[serieLimpia.length - 1];
          if (previo.x === actual.x) {
            serieLimpia[serieLimpia.length - 1] = {
              ...actual,
              marker: previo.marker || actual.marker,
              eventType: (previo.marker || actual.marker) ? 'abono' : actual.eventType
            };
            return serieLimpia;
          }

          const mismoSaldo = Math.abs(Number(previo.y || 0) - Number(actual.y || 0)) < 0.01;
          if (mismoSaldo && !actual.marker) {
            return serieLimpia;
          }

          serieLimpia.push(actual);
          return serieLimpia;
        }, []);
      }

      function construirEventosObligacionGraficoContinuo(ob, estaCerrada = false) {
        return limpiarSerieGraficoContinuo(construirEventosObligacionGrafico(ob, estaCerrada));
      }

      function obtenerFechasUnicasGraficoContinuo(eventosPorObligacion) {
        return [...new Set(
          eventosPorObligacion
            .flatMap((item) => item.eventos.map((evento) => evento.x))
            .filter((timestamp) => Number.isFinite(timestamp))
        )].sort((a, b) => a - b);
      }

      function construirSerieTotalGraficoContinuo(eventosPorObligacion) {
        const fechasUnicas = obtenerFechasUnicasGraficoContinuo(eventosPorObligacion);
        const puntos = fechasUnicas.map((timestamp) => {
          const esAbono = eventosPorObligacion.some((item) =>
            item.eventos.some((evento) => evento.x === timestamp && evento.eventType === 'abono')
          );

          return {
            x: timestamp,
            y: roundTo(eventosPorObligacion.reduce((sum, item) => {
              const saldo = obtenerSaldoObligacionEnFecha(item.eventos, timestamp);
              return sum + (saldo === null ? 0 : saldo);
            }, 0), 2),
            marker: esAbono,
            eventType: esAbono ? 'abono' : 'continuidad'
          };
        });

        return limpiarSerieGraficoContinuo(puntos);
      }

      function diezmarSerieGraficoContinuo(puntos, maxPoints) {
        const serie = limpiarSerieGraficoContinuo(puntos);
        if (serie.length <= maxPoints) return serie;

        const indicesClave = new Set([0, serie.length - 1]);
        serie.forEach((punto, index) => {
          if (punto.marker) indicesClave.add(index);
        });

        if (indicesClave.size >= maxPoints) {
          return serie.filter((_, index) => indicesClave.has(index));
        }

        const seleccionados = new Set(indicesClave);
        const disponibles = [];
        for (let i = 1; i < serie.length - 1; i++) {
          if (!indicesClave.has(i)) disponibles.push(i);
        }

        const cuposRestantes = Math.max(0, maxPoints - seleccionados.size);
        const rangoTotal = Math.max(DAY_IN_MS, Number(serie[serie.length - 1].x) - Number(serie[0].x));
        const intervaloObjetivo = cuposRestantes > 0
          ? Math.max(DAY_IN_MS, Math.ceil(rangoTotal / cuposRestantes))
          : Infinity;

        let umbralActual = Number(serie[0].x) + intervaloObjetivo;
        disponibles.forEach((index) => {
          if (seleccionados.size >= maxPoints) return;
          if (Number(serie[index].x) >= umbralActual) {
            seleccionados.add(index);
            umbralActual = Number(serie[index].x) + intervaloObjetivo;
          }
        });

        disponibles.forEach((index) => {
          if (seleccionados.size < maxPoints && !seleccionados.has(index)) {
            seleccionados.add(index);
          }
        });

        return serie.filter((_, index) => seleccionados.has(index));
      }

      function aplicarLimiteDatasetsGraficoContinuo(datasets) {
        const totalPuntos = datasets.reduce((sum, dataset) => sum + (dataset.data?.length || 0), 0);
        if (totalPuntos <= GRAFICO_MAX_TOTAL_POINTS) return datasets;

        const cantidadSeries = Math.max(1, datasets.length);
        const maxPorSerie = Math.max(2, Math.floor(GRAFICO_MAX_TOTAL_POINTS / cantidadSeries));
        return datasets.map((dataset) => ({
          ...dataset,
          data: diezmarSerieGraficoContinuo(dataset.data || [], maxPorSerie)
        }));
      }

      function obtenerFechasEjeGraficoContinuo(datasets) {
        return [...new Set(
          datasets.flatMap((dataset) => (dataset.data || []).map((punto) => punto.x))
        )].sort((a, b) => a - b);
      }

      function construirDatasetsGraficoDeudaContinuo() {
        const obligacionesHistoricas = obtenerObligacionesActivasParaGrafico()
          .map((obligacion) => ({ obligacion, estaCerrada: false }));

        const eventosPorObligacion = obligacionesHistoricas
          .map(({ obligacion, estaCerrada }) => ({
            obligacion,
            estaCerrada,
            eventos: construirEventosObligacionGraficoContinuo(obligacion, estaCerrada)
          }))
          .filter((item) => item.eventos.length > 0);

        const datasets = [];
        const serieTotal = construirSerieTotalGraficoContinuo(eventosPorObligacion);

        if (serieTotal.length > 0) {
          datasets.push({
            label: 'Total general',
            data: serieTotal,
            borderColor: '#009A67',
            backgroundColor: 'rgba(0, 154, 103, 0.16)',
            borderWidth: 4,
            fill: true,
            tension: 0.28,
            cubicInterpolationMode: 'monotone',
            pointRadius: (ctx) => ctx.raw?.marker ? 5 : 0,
            pointHoverRadius: (ctx) => ctx.raw?.marker ? 8 : 0,
            pointHitRadius: (ctx) => ctx.raw?.marker ? 14 : 6,
            pointBackgroundColor: '#009A67',
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2.5
          });
        }

        obtenerTopObligacionesParaGrafico().forEach(({ obligacion }, index) => {
          const estilo = GRAFICO_SERIES_TOP[index] || GRAFICO_SERIES_TOP[GRAFICO_SERIES_TOP.length - 1];
          const data = construirEventosObligacionGraficoContinuo(obligacion, false);
          if (!data.length) return;

          datasets.push({
            label: obligacion.entidad,
            data,
            borderColor: estilo.color,
            backgroundColor: estilo.fill,
            borderWidth: 3,
            fill: false,
            tension: 0.24,
            cubicInterpolationMode: 'monotone',
            borderDash: estilo.dash,
            pointRadius: (ctx) => ctx.raw?.marker ? 4.5 : 0,
            pointHoverRadius: (ctx) => ctx.raw?.marker ? 7 : 0,
            pointHitRadius: (ctx) => ctx.raw?.marker ? 14 : 6,
            pointBackgroundColor: estilo.color,
            pointBorderColor: '#ffffff',
            pointBorderWidth: 2.5,
            spanGaps: false
          });
        });

        return aplicarLimiteDatasetsGraficoContinuo(datasets);
      }

      function renderizarGrafico() {
        const canvas = byId('graficoDeuda');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        actualizarBotonesVistaGrafico();
        if (graficoInstance) graficoInstance.destroy();

        const datasets = construirDatasetsGraficoDeudaContinuo();
        const fechasEje = obtenerFechasEjeGraficoContinuo(datasets);
        const rangoMs = fechasEje.length > 1 ? (fechasEje[fechasEje.length - 1] - fechasEje[0]) : 0;
        const pasoEtiquetas = fechasEje.length > GRAFICO_MAX_AXIS_LABELS
          ? Math.ceil(fechasEje.length / GRAFICO_MAX_AXIS_LABELS)
          : 1;
        const vistaMensual = vistaGraficoActual === 'mensual' || rangoMs > (180 * DAY_IN_MS);
        const ahora = normalizarTimestampGraficoPorFecha(Date.now()) || Date.now();

        graficoInstance = new Chart(ctx, {
          type: 'line',
          data: {
            datasets: datasets.length > 0 ? datasets : [{
              label: 'Total general',
              data: [
                { x: ahora, y: 0, marker: false, eventType: 'continuidad' },
                { x: ahora + DAY_IN_MS, y: 0, marker: false, eventType: 'continuidad' }
              ],
              borderColor: '#CBD5E1',
              backgroundColor: 'rgba(203, 213, 225, 0.12)',
              borderWidth: 2,
              fill: true,
              tension: 0.2,
              cubicInterpolationMode: 'monotone',
              pointRadius: 0
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            normalized: true,
            interaction: {
              mode: 'nearest',
              intersect: false
            },
            scales: {
              x: {
                type: 'time',
                time: {
                  unit: vistaMensual ? 'month' : 'day',
                  round: 'day',
                  displayFormats: {
                    day: 'd/M',
                    month: 'M/yy'
                  }
                },
                grid: {
                  display: false,
                  drawBorder: false
                },
                ticks: {
                  source: 'data',
                  autoSkip: false,
                  color: '#5B7088',
                  padding: 8,
                  callback: (value, index, ticks) => {
                    if (pasoEtiquetas > 1 && index % pasoEtiquetas !== 0 && index !== ticks.length - 1) {
                      return '';
                    }
                    return formatearFechaGraficoContinuo(value, rangoMs);
                  }
                }
              },
              y: {
                beginAtZero: true,
                grid: {
                  color: 'rgba(31, 78, 121, 0.10)',
                  drawBorder: false
                },
                ticks: {
                  color: '#5B7088',
                  padding: 8,
                  callback: (value) => fmtCOPCompacto(value)
                }
              }
            },
            plugins: {
              legend: {
                position: 'bottom',
                labels: {
                  usePointStyle: true,
                  pointStyle: 'line',
                  padding: 16,
                  color: '#1F2937'
                }
              },
              tooltip: {
                backgroundColor: 'rgba(17, 24, 39, 0.92)',
                titleColor: '#F8FAFC',
                bodyColor: '#F8FAFC',
                borderColor: 'rgba(255, 255, 255, 0.12)',
                borderWidth: 1,
                padding: 12,
                displayColors: true,
                callbacks: {
                  title: (items) => formatearFechaGraficoTooltip(items?.[0]?.raw?.x ?? items?.[0]?.parsed?.x),
                  label: (context) => `${context.dataset.label}: ${fmtCOP(context.parsed.y)}`
                }
              }
            }
          }
        });
      }

      /* ========= LOGROS ========= */
      function verificarLogros() {
        const m = calcularMetricasGlobales();
        const nuevos = [];

        if (!logrosDesbloqueados.includes('primer_abono') && m.capitalTotal > 0) nuevos.push('primer_abono');
        if (!logrosDesbloqueados.includes('ahorrador_100k') && m.interesesTotales >= 100000) nuevos.push('ahorrador_100k');
        if (!logrosDesbloqueados.includes('ahorrador_500k') && m.interesesTotales >= 500000) nuevos.push('ahorrador_500k');
        if (!logrosDesbloqueados.includes('ahorrador_1m') && m.interesesTotales >= 1000000) nuevos.push('ahorrador_1m');
        if (!logrosDesbloqueados.includes('deuda_cero') && obligaciones.filter(o => o.saldoActual > 0).length === 0 && obligacionesCerradas.length > 0) nuevos.push('deuda_cero');
        if (!logrosDesbloqueados.includes('acelerador') && m.cuotasTotales >= 12) nuevos.push('acelerador');

        if (nuevos.length > 0) {
          logrosDesbloqueados.push(...nuevos);
          guardarLogros();
          nuevos.forEach(l => notificar(`🔔 Logro: ${LOGROS_CONFIG.find(x => x.id === l).nombre}`, 'success'));
          lanzarConfeti(50);
        }
        renderizarLogros();
      }

      function renderizarLogros() {
        byId('logrosContainer').innerHTML = LOGROS_CONFIG.map(l => `
          <div class="logro-card ${logrosDesbloqueados.includes(l.id) ? 'desbloqueado' : 'bloqueado'}">
            <div class="logro-icono">${l.icono}</div>
            <div class="logro-nombre">${l.nombre}</div>
            <div class="logro-desc">${l.descripcion}</div>
          </div>
        `).join('');
        byId('contadorLogros').textContent = `${logrosDesbloqueados.length}/${LOGROS_CONFIG.length}`;
      }

      function obtenerDescripcionTipoMovimiento(tipoMovimiento) {
        if (normalizarTipoMovimiento(tipoMovimiento) === TIPOS_MOVIMIENTO.ABONO_CAPITAL) {
          return 'Reduce solo el saldo pendiente y recalcula la proyeccion futura sin marcar otra cuota pagada.';
        }
        return 'Registra el pago de la cuota del periodo y, si indicas un valor, aplica tambien un abono extraordinario a capital.';
      }

      function renderizarHistorialMovimientosObligacion(ob) {
        const movimientos = [...(ob?.historicoAbonos || [])].reverse().slice(0, 4);
        if (movimientos.length === 0) {
          return '<div class="obligacion-history-empty">Sin movimientos registrados todavia.</div>';
        }

        return movimientos.map((movimiento) => {
          const etiqueta = obtenerEtiquetaTipoMovimiento(movimiento, ob);
          const badgeClass = esMovimientoAbonoCapital(movimiento) ? 'badge-warning' : 'badge-primary';
          const fechaMovimiento = movimiento?.fecha
            || formatDateDisplay(parseStoredDate(movimiento?.fechaRegistro) || new Date());
          const cuotaPagadaCOP = Number(movimiento?.cuotaPagadaCOP || 0);
          const cuotaPagadaUVR = Number(movimiento?.cuotaPagadaUVR || 0);
          const abonoCapitalCOP = obtenerMontoAbonoCOP(ob, movimiento);
          const abonoCapitalUVR = Number(movimiento?.montoAbonoUVR || 0);
          const ahorroInteresesCOP = obtenerAhorroInteresesCOP(ob, movimiento);
          const valorPrincipal = esMovimientoAbonoCapital(movimiento)
            ? formatearMontoMovimiento(ob, abonoCapitalCOP, abonoCapitalUVR)
            : formatearMontoMovimiento(ob, cuotaPagadaCOP, cuotaPagadaUVR);

          const detalles = [];
          if (!esMovimientoAbonoCapital(movimiento) && Number(movimiento?.interesPeriodo || 0) > 0) {
            detalles.push(`Interes: ${fmtCOP(movimiento.interesPeriodo)}`);
          }
          if (!esMovimientoAbonoCapital(movimiento) && Number(movimiento?.amortizacionCuota || 0) > 0) {
            detalles.push(`Capital cuota: ${fmtCOP(movimiento.amortizacionCuota)}`);
          }
          if (abonoCapitalCOP > 0) {
            detalles.push(`Abono capital: ${formatearMontoMovimiento(ob, abonoCapitalCOP, abonoCapitalUVR)}`);
          }
          if (ahorroInteresesCOP > 0) {
            detalles.push(`Ahorro: ${fmtCOP(ahorroInteresesCOP)}`);
          }
          if (Number(movimiento?.mesesAhorrados || 0) > 0) {
            detalles.push(`Tiempo: -${movimiento.mesesAhorrados} mes(es)`);
          }
          detalles.push(`Saldo: ${formatearSaldoPosteriorMovimiento(ob, movimiento)}`);

          return `
            <div class="obligacion-history-item">
              <div class="obligacion-history-head">
                <span class="badge ${badgeClass}">${etiqueta}</span>
                <small>${fechaMovimiento}</small>
              </div>
              <div class="obligacion-history-main">${valorPrincipal}</div>
              <div class="obligacion-history-detail">${detalles.join(' | ')}</div>
            </div>
          `;
        }).join('');
      }

      window.actualizarTipoMovimientoObligacion = function(id) {
        const select = byId(`tipoMovimiento_${id}`);
        const input = byId(`abono_${id}`);
        const hint = byId(`tipoMovimientoHint_${id}`);
        const buttonLabel = byId(`btnMovimientoLabel_${id}`);
        const tipoMovimiento = normalizarTipoMovimiento(select?.value);

        if (input) {
          input.placeholder = tipoMovimiento === TIPOS_MOVIMIENTO.ABONO_CAPITAL
            ? 'Abono a capital en COP'
            : 'Abono extra en COP';
        }

        if (hint) {
          hint.textContent = obtenerDescripcionTipoMovimiento(tipoMovimiento);
        }

        if (buttonLabel) {
          buttonLabel.textContent = tipoMovimiento === TIPOS_MOVIMIENTO.ABONO_CAPITAL
            ? 'Registrar abono a capital'
            : 'Pagar cuota';
        }
      };

      /* ========= APLICAR ABONO CORREGIDO ========= */
      window.aplicarAbono = function(id) {
        const ob = obligaciones.find(o => o.id === id);
        if (!ob) return;
        
        const abonoInput = byId('abono_' + id);
        const modoSelect = byId('modo_' + id);
        const tipoMovimientoSelect = byId('tipoMovimiento_' + id);
        const montoAbono = Number(abonoInput?.value) || 0;
        const modoRecalculo = modoSelect?.value || 'mantener_cuota';
        const tipoMovimiento = normalizarTipoMovimiento(tipoMovimientoSelect?.value);

        if (tipoMovimiento === TIPOS_MOVIMIENTO.ABONO_CAPITAL && montoAbono <= 0) {
          notificar('Ingresa un valor mayor a cero para registrar el abono a capital.', 'warning');
          return;
        }

        const cuotaAntes = Number(ob.valorCuota || 0);
        const r = tipoMovimiento === TIPOS_MOVIMIENTO.ABONO_CAPITAL
          ? calcularAbonoSoloCapital(ob, montoAbono, modoRecalculo)
          : calcularPagoPeriodoYAbono(ob, montoAbono, modoRecalculo);

        // Actualizar estado
        ob.numeroCuota = r.cuotaActualizada;
        ob.saldoActual = r.saldoTrasAbono;
        
        // Ajustar cuota según el modo
        if (modoRecalculo === 'mantener_plazo') {
          ob.valorCuota = r.nuevaCuota;
          // CORRECCIÓN: Actualizar cantidadCuotas para reflejar el plazo correcto
          if (r.nuevoPlazo > 0) {
            ob.cantidadCuotas = ob.numeroCuota - 1 + r.nuevoPlazo;
          }
        } else {
          ob.valorCuota = r.nuevaCuota;
          // CORRECCIÓN: Actualizar cantidadCuotas con el nuevo plazo calculado
          if (r.nuevoPlazo > 0) {
            ob.cantidadCuotas = ob.numeroCuota - 1 + r.nuevoPlazo;
          } else if (r.saldoTrasAbono <= 0) {
            ob.cantidadCuotas = ob.numeroCuota - 1;
          }
        }

        // Ajuste final: si el saldo es menor que la cuota, la cuota debe ser el saldo
        if (ob.saldoActual > 0 && ob.saldoActual < ob.valorCuota) {
          ob.valorCuota = ob.saldoActual;
        }

        // Si el saldo es 0 o muy cercano, la cuota debe ser 0
        if (ob.saldoActual <= 0.01) {
          ob.valorCuota = 0;
          // CORRECCIÓN: Si la deuda se liquidó, ajustar cantidadCuotas
          if (ob.numeroCuota <= ob.cantidadCuotas) {
            ob.cantidadCuotas = ob.numeroCuota - 1;
          }
        }

        // Registrar en histórico
        const debeRegistrarMovimiento = tipoMovimiento === TIPOS_MOVIMIENTO.ABONO_CAPITAL
          ? r.montoAbonoCOPReal > 0
          : r.cuotaPagadaCOP > 0 || r.montoAbonoCOPReal > 0;

        if (debeRegistrarMovimiento) {
          if (!ob.historicoAbonos) ob.historicoAbonos = [];
          const registroAbono = {
            tipoMovimiento,
            fecha: formatDateDisplay(new Date()),
            fechaRegistro: new Date().toISOString(),
            monto: montoAbono,
            cuotaPagadaCOP: r.cuotaPagadaCOP,
            montoAbonoCOP: r.montoAbonoCOPReal,
            ahorroIntereses: r.ahorroInteresesCOPReales,
            amortizacionCuota: r.amortizacionCuotaCOP,
            interesPeriodo: r.interesPeriodoCOP,
            saldoPosterior: r.saldoTrasAbonoCOP,
            modoRecalculo,
            nuevaCuota: ob.valorCuota,
            nuevoPlazo: r.nuevoPlazo,
            mesesAhorrados: r.mesesAhorrados,
            cuotaAntes
          };
          
          if (esCreditoUVR(ob)) {
            registroAbono.cuotaPagadaUVR = r.cuotaPagadaUVR;
            registroAbono.montoAbonoUVR = r.montoAbonoUVR;
            registroAbono.ahorroInteresesUVR = r.ahorroIntereses;
            registroAbono.saldoPosteriorUVR = r.saldoTrasAbono;
            registroAbono.uvrOperacion = r.uvrOperacion;
          }
          
          ob.historicoAbonos.push(registroAbono);
        }

        guardarDatos();
        renderizarTodo();
        
        // Efecto visual
        const card = document.querySelector(`[data-id="${id}"]`);
        if (card) {
          card.classList.add('highlight-pulse');
          setTimeout(() => card.classList.remove('highlight-pulse'), 1000);
        }

        if (montoAbono > 0) {
          if (r.saldoTrasAbono <= 0) {
            notificar(`🎉 ¡INCREÍBLE! Has liquidado completamente esta deuda`, 'success');
            lanzarConfeti(150);
          } else if (tipoMovimiento === TIPOS_MOVIMIENTO.ABONO_CAPITAL) {
            notificar(`Abono a capital registrado por ${fmtCOP(r.montoAbonoCOPReal)}`, 'success');
            if (r.ahorroInteresesCOPReales > 0) {
              notificar(`Ahorro proyectado en intereses: ${fmtCOP(r.ahorroInteresesCOPReales)}`, 'success');
            }
            if (r.mesesAhorrados > 0) {
              notificar(`Redujiste tu deuda en ${r.mesesAhorrados} mes(es)`, 'success');
            }
          } else {
            notificar(`✅ Ahorraste ${fmtCOP(r.ahorroInteresesCOPReales)} en intereses`, 'success');
            if (r.mesesAhorrados > 0) {
              notificar(`⏱️ Redujiste tu deuda en ${r.mesesAhorrados} mes(es)`, 'success');
            }
            if (r.ahorroInteresesCOPReales > 50000) lanzarConfeti(50);
          }
        } else {
          notificar(`✅ Cuota ${ob.numeroCuota-1} pagada. Nueva cuota: ${ob.numeroCuota}/${ob.cantidadCuotas}`, 'info');
        }
      };

      /* ========= CERRAR OBLIGACIÓN ========= */
      window.cerrarObligacion = function(id) {
        const ob = obligaciones.find(o => o.id === id);
        if (!ob) return;
        
        if (ob.saldoActual > 0) {
          notificar('❌ El saldo debe ser cero para cerrar', 'warning');
          return;
        }

        const historicoAbonos = ob.historicoAbonos || [];
        const numeroAbonos = contarMovimientosCapital(ob, historicoAbonos);
        const totalAbonosCOP = historicoAbonos.reduce((s, a) => s + obtenerMontoAbonoCOP(ob, a), 0);
        const totalInteresesDejadosCOP = historicoAbonos.reduce((s, a) => s + obtenerAhorroInteresesCOP(ob, a), 0);
        const totalAbonosUVR = esCreditoUVR(ob)
          ? historicoAbonos.reduce((s, a) => s + Number(a.montoAbonoUVR || 0), 0)
          : 0;
        const totalInteresesDejadosUVR = esCreditoUVR(ob)
          ? historicoAbonos.reduce((s, a) => s + Number(a.ahorroInteresesUVR || 0), 0)
          : 0;
        const capitalAmortizado = totalAbonosCOP;
        const interesPeriodoTotal = historicoAbonos.reduce((s, a) => s + (a.interesPeriodo || 0), 0);
        const mesesAhorradosTotal = historicoAbonos.reduce((s, a) => s + (a.mesesAhorrados || 0), 0);
        
        const cuotasPendientesInicial = Math.max(0, (ob.cantidadCuotasOriginal || ob.cantidadCuotas) - (ob.cuotaInicial || 1) + 1);
        const cuotasPagadas = ob.numeroCuota - (ob.cuotaInicial || 1);
        const cuotasDejadasDePagar = Math.max(0, cuotasPendientesInicial - cuotasPagadas);
        
        const cerrada = {
          id: crypto.randomUUID(),
          entidad: ob.entidad,
          tipoCredito: ob.tipoCredito,
          moneda: ob.moneda || 'COP',
          fechaCierre: new Date().toLocaleString('es-CO'),
          fechaCierreISO: new Date().toISOString(),
          valorCreditoOriginal: ob.valorCredito,
          valorCreditoOriginalCOP: esCreditoUVR(ob) ? obtenerValorCreditoBaseCOP(ob) : Number(ob.valorCredito || 0),
          saldoFinal: ob.saldoActual,
          interesEA: ob.interesEA,
          numeroAbonos: numeroAbonos,
          totalAbonos: totalAbonosCOP,
          totalAbonosCOP: totalAbonosCOP,
          totalAbonosUVR,
          interesesDejadosDePagar: totalInteresesDejadosCOP,
          interesesDejadosDePagarCOP: totalInteresesDejadosCOP,
          interesesDejadosDePagarUVR: totalInteresesDejadosUVR,
          cuotasDejadasDePagar: cuotasDejadasDePagar,
          historicoAbonos: historicoAbonos,
          capitalAmortizado: capitalAmortizado,
          interesPeriodoTotal: interesPeriodoTotal,
          mesesAhorradosTotal: mesesAhorradosTotal,
          creadoAt: ob.creadoAt,
          uvr: ob.uvr
        };

        obligacionesCerradas.push(normalizarObligacionCerrada(cerrada));
        obligaciones = obligaciones.filter(o => o.id !== id);
        
        guardarDatos();
        renderizarTodo();
        lanzarConfeti(150);
        
        let mensaje = `🎉 ¡Felicidades! Cerraste ${ob.entidad}`;
        if (cuotasDejadasDePagar >= 12) {
          mensaje += ` y evitaste ${cuotasDejadasDePagar} cuotas! 🏆`;
        } else if (totalInteresesDejadosCOP > 100000) {
          mensaje += ` con un ahorro de ${fmtCOP(totalInteresesDejadosCOP)}! 💰`;
        }
        
        notificar(mensaje, 'success');
      };

      /* ========= RENDERIZADO OBLIGACIONES ========= */
      function renderObligaciones() {
        if (ordenMetodo === 'snowball') {
          obligaciones.sort((a, b) => {
            const saldoA = a.moneda === 'UVR' ? uvrToCop(a.saldoActual, obtenerUVRProyectadaObligacion(a)) : a.saldoActual;
            const saldoB = b.moneda === 'UVR' ? uvrToCop(b.saldoActual, obtenerUVRProyectadaObligacion(b)) : b.saldoActual;
            return saldoA - saldoB;
          });
        } else {
          obligaciones.sort((a, b) => parsePctToDec(b.interesEA) - parsePctToDec(a.interesEA));
        }

        const container = byId('listaObligaciones');
        if (obligaciones.length === 0) {
          container.innerHTML = '<div class="card text-muted text-center" style="padding:40px;">No hay obligaciones activas. ¡Comienza creando una!</div>';
          return;
        }

        container.innerHTML = obligaciones.map(ob => {
          // CORRECCIÓN: Calcular plazo restante correctamente después de abonos
          const plazoRestante = Math.max(0, ob.cantidadCuotas - ob.numeroCuota + 1);
          const saldoMostrar = esCreditoUVR(ob) ? formatearDualUVR(ob.saldoActual, obtenerSaldoActualCOP(ob)) : fmtCOP(ob.saldoActual);
          const cuotaMostrar = esCreditoUVR(ob) ? formatearDualUVR(ob.valorCuota, roundTo(uvrToCop(ob.valorCuota, obtenerUVRProyectadaObligacion(ob, ob.fechaProximoVencimiento || addMonthsIso(hoyISO(), 1))), 2)) : fmtCOP(ob.valorCuota);
          
          const interesesAcum = ob.historicoAbonos?.reduce((s, a) => s + (a.ahorroIntereses || 0), 0) || 0;
          const cuotasAhorradas = ob.historicoAbonos?.reduce((s, a) => s + (a.mesesAhorrados || 0), 0) || 0;
          const movimientosRegistrados = ob.historicoAbonos?.length || 0;
          const abonosCapitalRegistrados = contarMovimientosCapital(ob);
          const historialMovimientos = renderizarHistorialMovimientosObligacion(ob);
          
          const monedaBadge = esCreditoUVR(ob)
            ? '<span class="badge badge-uvr"><i class="fas fa-chart-line"></i> UVR</span>' 
            : '<span class="badge badge-primary"><i class="fas fa-coins"></i> COP</span>';
          
          return `
          <div class="card obligacion-card" data-id="${ob.id}">
            <div class="obligacion-header">
              <div class="obligacion-heading">
                <h3>${ob.entidad} <span class="badge badge-success">${ob.tipoCredito}</span> ${monedaBadge}</h3>
                <small><i class="far fa-calendar-alt"></i> Vence: ${ob.fechaProximoVencimiento}</small>
              </div>
              <div class="obligacion-header-side">
                <div class="obligacion-badges">
                  <span class="badge badge-primary"><i class="fas fa-piggy-bank"></i> ${fmtMonto(interesesAcum, ob.moneda)}</span>
                </div>
                <div class="obligacion-actions">
                  ${esCreditoUVR(ob) ? `<button class="btn btn-sm btn-outline" onclick="abrirProyeccionUVR('${ob.id}')"><i class="fas fa-chart-line"></i> Proyección</button>` : ''}
                  <button class="btn btn-sm btn-outline" onclick="editarObligacion('${ob.id}')">
                    <i class="fas fa-pen"></i> Editar
                  </button>
                  <button class="btn btn-sm btn-danger" onclick="solicitarEliminarObligacion('${ob.id}')">
                    <i class="fas fa-trash"></i> Eliminar
                  </button>
                  <button class="btn btn-sm btn-outline" onclick="cerrarObligacion('${ob.id}')">
                    <i class="fas fa-check-circle"></i> Cerrar
                  </button>
                </div>
              </div>
            </div>

            <div class="grid grid-4 obligacion-metrics">
              <div><b>Saldo</b><br>${saldoMostrar}</div>
              <div><b>Cuota</b><br>${cuotaMostrar}</div>
              <div><b>Interés EA</b><br>${ob.interesEA}%</div>
              <div><b>Cuota actual</b><br><span class="cuota-actual">${ob.numeroCuota}/${ob.cantidadCuotas}</span></div>
            </div>

            <div class="grid grid-4 obligacion-payment-grid">
              <input type="number" id="abono_${ob.id}" class="form-control" placeholder="Abono extra en COP" value="0" min="0" step="10000">
              <select id="tipoMovimiento_${ob.id}" class="form-control" onchange="actualizarTipoMovimientoObligacion('${ob.id}')">
                <option value="${TIPOS_MOVIMIENTO.PAGO_CUOTA}">Pago de cuota</option>
                <option value="${TIPOS_MOVIMIENTO.ABONO_CAPITAL}">Abono a capital</option>
              </select>
              <select id="modo_${ob.id}" class="form-control">
                <option value="mantener_cuota">Mantener cuota (menos plazo)</option>
                <option value="mantener_plazo">Mantener plazo (cuota menor)</option>
              </select>
              <button class="btn btn-secondary" onclick="aplicarAbono('${ob.id}')">
                <i class="fas fa-check"></i> <span id="btnMovimientoLabel_${ob.id}">Pagar cuota</span>
              </button>
            </div>
            <div class="obligacion-payment-note" id="tipoMovimientoHint_${ob.id}">${obtenerDescripcionTipoMovimiento(TIPOS_MOVIMIENTO.PAGO_CUOTA)}</div>

            <div class="grid grid-4 obligacion-preview-grid">
              <div><b>Nuevo saldo:</b> <input type="text" readonly class="form-control" id="nuevoSaldo_${ob.id}" value="${saldoMostrar}"></div>
              <div><b>Nueva cuota:</b> <input type="text" readonly class="form-control" id="nuevaCuota_${ob.id}" value="${cuotaMostrar}"></div>
              <div><b>Plazo restante:</b> <input type="text" readonly class="form-control" id="nuevoPlazo_${ob.id}" value="${plazoRestante}"></div>
              <div><b>Ahorro:</b> <input type="text" readonly class="form-control" id="ahorro_${ob.id}" value="${fmtMonto(0, ob.moneda)}"></div>
            </div>
            <div class="grid grid-4 obligacion-summary-grid">
              <div>Meses ahorrados: <span id="meses_${ob.id}">${cuotasAhorradas}</span></div>
              <div>Total ahorrado: ${fmtMonto(interesesAcum, ob.moneda)}</div>
              <div>Movimientos: ${movimientosRegistrados}</div>
              <div>Abonos a capital: ${abonosCapitalRegistrados}</div>
            </div>
            <div class="obligacion-history">
              <div class="obligacion-history-title">Ultimos movimientos</div>
              ${historialMovimientos}
            </div>
          </div>
        `}).join('');
      }

      /* ========= RENDERIZADO HISTÓRICO ========= */
      function renderCerradas() {
        const container = byId('cerradasListado');
        
        if (obligacionesCerradas.length === 0) {
          container.innerHTML = `
            <div style="text-align:center; padding:60px 20px; background:var(--color-bg); border-radius:var(--radius-lg);">
              <i class="fas fa-folder-open" style="font-size:64px; color:var(--color-muted); margin-bottom:20px;"></i>
              <h3 style="color:var(--color-text); margin-bottom:8px;">Aún no has cerrado ninguna obligación</h3>
              <p style="color:var(--color-muted);">Cuando liquides una deuda, aparecerá aquí con todos los detalles</p>
            </div>
          `;
          
          byId('totalCerradas').textContent = '0';
          byId('totalInteresesHistoricos').textContent = '$0';
          byId('totalCuotasHistoricas').textContent = '0';
          byId('totalAbonosHistoricos').textContent = '0';
          return;
        }

        const totalCerradas = obligacionesCerradas.length;
        const totalIntereses = obligacionesCerradas.reduce((sum, c) => {
          const cerrada = normalizarObligacionCerrada(c);
          return sum + Number(cerrada.interesesDejadosDePagarCOP || cerrada.interesesDejadosDePagar || 0);
        }, 0);
        const totalCuotas = obligacionesCerradas.reduce((sum, c) => sum + (c.cuotasDejadasDePagar || 0), 0);
        const totalAbonos = obligacionesCerradas.reduce((sum, c) => {
          const cerrada = normalizarObligacionCerrada(c);
          return sum + (c.numeroAbonos || contarMovimientosCapital(cerrada, cerrada.historicoAbonos || []));
        }, 0);

        byId('totalCerradas').textContent = totalCerradas;
        byId('totalInteresesHistoricos').textContent = fmtCOP(totalIntereses);
        byId('totalCuotasHistoricas').textContent = totalCuotas;
        byId('totalAbonosHistoricos').textContent = totalAbonos;

        container.innerHTML = obligacionesCerradas.slice().reverse().map(c => {
          const cerrada = normalizarObligacionCerrada(c);
          const numeroAbonos = c.numeroAbonos || contarMovimientosCapital(cerrada, cerrada.historicoAbonos || []);
          const valorCreditoOriginal = cerrada.valorCreditoOriginal || 0;
          const interesesEnCOP = Number(cerrada.interesesDejadosDePagarCOP || cerrada.interesesDejadosDePagar || 0);
          const valorOriginalEnCOP = Number(cerrada.valorCreditoOriginalCOP || valorCreditoOriginal || 0);
          const porcentajeAhorro = valorOriginalEnCOP > 0 
            ? Math.round((interesesEnCOP / valorOriginalEnCOP) * 100) 
            : 0;

          const monedaIcon = c.moneda === 'UVR' 
            ? '<span class="badge badge-uvr" style="margin-left: 8px;"><i class="fas fa-chart-line"></i> UVR</span>' 
            : '';

          return `
            <div class="cerrada-card">
              <div class="cerrada-header">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap: wrap; gap: 10px;">
                  <div>
                    <h3 style="margin:0; display:flex; align-items:center; gap:8px; flex-wrap: wrap;">
                      <i class="fas fa-check-circle" style="color:var(--color-secondary);"></i>
                      ${c.entidad} ${monedaIcon}
                    </h3>
                    <small style="opacity:0.9;">
                      <i class="far fa-calendar-alt"></i> Cerrada: ${c.fechaCierre || 'Fecha no disponible'}
                    </small>
                  </div>
                  <span class="cerrada-badge">
                    <i class="fas fa-tag"></i> COMPLETADA
                  </span>
                </div>
              </div>
              
              <div class="cerrada-metrics">
                <div class="cerrada-metric secondary">
                  <div class="cerrada-metric-label">
                    <i class="fas fa-piggy-bank"></i> Intereses ahorrados
                  </div>
                  <div class="cerrada-metric-value">${fmtCOP(interesesEnCOP)}</div>
                  <div class="cerrada-metric-sub">${porcentajeAhorro}% del crédito original</div>
                </div>
                
                <div class="cerrada-metric primary">
                  <div class="cerrada-metric-label">
                    <i class="fas fa-calendar-times"></i> Cuotas evitadas
                  </div>
                  <div class="cerrada-metric-value">${c.cuotasDejadasDePagar || 0}</div>
                  <div class="cerrada-metric-sub">${((c.cuotasDejadasDePagar || 0) * 30).toLocaleString()} días recuperados</div>
                </div>
                
                <div class="cerrada-metric accent">
                  <div class="cerrada-metric-label">
                    <i class="fas fa-hand-holding-usd"></i> Abonos realizados
                  </div>
                  <div class="cerrada-metric-value">${numeroAbonos}</div>
                  <div class="cerrada-metric-sub">${numeroAbonos === 1 ? 'abono extra' : 'abonos extras'}</div>
                </div>
              </div>
              
              <div class="cerrada-details">
                <div><span style="color:var(--color-muted);">Crédito original:</span><br><strong>${fmtCOP(valorOriginalEnCOP)}</strong></div>
                <div><span style="color:var(--color-muted);">Total abonado:</span><br><strong>${fmtCOP(cerrada.totalAbonosCOP || cerrada.totalAbonos || 0)}</strong></div>
                <div><span style="color:var(--color-muted);">Tasa EA:</span><br><strong>${c.interesEA || 'N/A'}%</strong></div>
              </div>
              
              ${(c.cuotasDejadasDePagar || 0) >= 12 ? `
                <div class="cerrada-logro">
                  <i class="fas fa-trophy"></i>
                  <span>¡Logro desbloqueado: Acelerador! Evitaste 12+ cuotas</span>
                </div>
              ` : ''}
              
              ${c.mesesAhorradosTotal ? `
                <div class="cerrada-logro" style="background:var(--color-secondary-light); border-color:var(--color-secondary);">
                  <i class="fas fa-clock"></i>
                  <span>Total meses ahorrados: ${c.mesesAhorradosTotal}</span>
                </div>
              ` : ''}
            </div>
          `;
        }).join('');
      }

      /* ========= COMPARADOR DE OFERTAS ========= */
      function actualizarOfertas() {
        const tipo = byId('comparadorTipo').value;
        const messageEl = byId('ofertasMessage');
        const listadoEl = byId('ofertasListado');

        if (obligaciones.length === 0) {
          messageEl.style.display = 'block';
          listadoEl.innerHTML = '';
          return;
        }

        messageEl.style.display = 'none';

        const tiposUsuario = [...new Set(obligaciones.map(o => o.tipoCredito))];
        
        let ofertasMostrar = [];
        
        if (tipo === 'todos') {
          tiposUsuario.forEach(t => {
            if (OFERTAS_DB[t]) {
              ofertasMostrar = [...ofertasMostrar, ...OFERTAS_DB[t]];
            }
          });
          if (ofertasMostrar.length < 3) {
            ofertasMostrar = [...ofertasMostrar, ...OFERTAS_DB.consumo.slice(0, 2)];
          }
        } else {
          ofertasMostrar = OFERTAS_DB[tipo] || [];
        }

        const ofertasUnicas = [];
        ofertasMostrar.forEach(oferta => {
          if (!ofertasUnicas.some(o => o.entidad === oferta.entidad && o.tasa === oferta.tasa)) {
            ofertasUnicas.push(oferta);
          }
        });
        
        const ofertasOrdenadas = ofertasUnicas
          .sort((a, b) => a.tasa - b.tasa)
          .slice(0, 6);

        if (ofertasOrdenadas.length === 0) {
          listadoEl.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:40px;">
              <p style="color:var(--color-muted);">No hay ofertas disponibles para este tipo de crédito</p>
            </div>
          `;
          return;
        }

        listadoEl.innerHTML = ofertasOrdenadas.map(o => {
          const ahorroPotencial = obligaciones.length > 0 
            ? Math.round(obtenerSaldoActualCOP(obligaciones[0]) * ((obligaciones[0].interesEA - o.tasa) / 100) / 12)
            : 0;

          return `
            <div class="oferta-card">
              <div class="oferta-badge">Recomendado</div>
              <div class="oferta-entidad">
                <span>${o.icono}</span> ${o.entidad}
              </div>
              <div class="oferta-tasa">${o.tasa}% EA</div>
              <div style="font-size:13px; color:var(--color-text); margin-bottom:12px;">
                <i class="fas fa-tag" style="color:var(--color-muted);"></i> ${o.tipo}
              </div>
              <div style="font-size:12px; color:var(--color-muted); margin-bottom:16px;">
                <i class="fas fa-info-circle"></i> ${o.requisitos}
              </div>
              <div class="oferta-detalle">
                <span><i class="fas fa-wallet"></i> Ahorro potencial</span>
                <span style="color:var(--color-secondary); font-weight:600;">${fmtCOP(ahorroPotencial)}/mes</span>
              </div>
            </div>
          `;
        }).join('');
      }

      window.filtrarOfertas = actualizarOfertas;

      /* ========= SIMULADOR ========= */
      window.abrirSimulador = function() {
        const modal = byId('modalSimulador');
        const select = byId('simulacionObligacion');
        
        if (obligaciones.length === 0) {
          notificar('Primero debes crear una obligación', 'warning');
          return;
        }
        
        select.innerHTML = obligaciones.map(ob => {
          const textoSaldo = esCreditoUVR(ob)
            ? `${fmtUVR(ob.saldoActual)} | ${fmtCOP(obtenerSaldoActualCOP(ob))}`
            : fmtCOP(ob.saldoActual);
          return `<option value="${ob.id}" data-moneda="${ob.moneda}">${ob.entidad} - ${textoSaldo}</option>`;
        }).join('');
        
        actualizarLabelSimulador();
        modal.style.display = 'flex';
        actualizarSimulacion();
      };

      function actualizarLabelSimulador() {
        const label = byId('abonoBaseLabel');
        label.textContent = 'Abono constante mensual (COP)';
        byId('simulacionAbono').step = '10000';
        byId('simulacionAbono').placeholder = 'Ej: 50000';
      }

      window.cerrarSimulador = () => byId('modalSimulador').style.display = 'none';

      function formatearAbonoSimulador(ob, abonoCOP, comparativo) {
        const montoCOP = fmtCOP(abonoCOP);
        if (!esCreditoUVR(ob)) return montoCOP;
        const equivalenteUVR = Number(comparativo?.simulacionConAbonos?.abonoConstanteUVRAproximado || 0);
        return equivalenteUVR > 0 ? `${montoCOP} | ${fmtUVR(equivalenteUVR)}` : montoCOP;
      }

      function actualizarResumenComparativoSimulador(ob, comparativo) {
        if (!ob || !comparativo) return;

        const { simulacionBase, simulacionConAbonos, ahorroTotal, reduccionIntereses, mesesReducidos } = comparativo;
        const chip = byId('simComparativoAbono');
        const resumen = byId('simResumenEscenario');
        const warningBox = byId('simAhorroWarnings');
        const equivalenteUVR = Number(simulacionConAbonos?.abonoConstanteUVRAproximado || 0);

        if (comparativo.abonoConstanteCOP > 0) {
          const notaUVR = esCreditoUVR(ob) && equivalenteUVR > 0
            ? ` (${fmtUVR(equivalenteUVR)} aprox. al inicio)`
            : '';
          if (chip) chip.textContent = `${fmtCOP(comparativo.abonoConstanteCOP)}/mes`;
          if (resumen) resumen.textContent = `Comparación del pago normal frente a un abono extraordinario constante de ${fmtCOP(comparativo.abonoConstanteCOP)}${notaUVR}.`;
        } else {
          if (chip) chip.textContent = 'Sin abonos';
          if (resumen) resumen.textContent = 'Sin abonos extraordinarios configurados. Este escenario coincide con el pago normal.';
        }

        byId('simTotalSinAbonos').textContent = fmtCOP(simulacionBase.totalPagadoCOP);
        byId('simTotalConAbonos').textContent = fmtCOP(simulacionConAbonos.totalPagadoCOP);
        byId('simAhorroTotal').textContent = fmtCOP(ahorroTotal);
        byId('simTiempoReducido').textContent = comparativo.tiempoReducidoTexto;
        byId('simInteresesSinAbonos').textContent = fmtCOP(simulacionBase.totalInteresesCOP);
        byId('simInteresesConAbonos').textContent = fmtCOP(simulacionConAbonos.totalInteresesCOP);
        byId('simInteresesAhorrados').textContent = fmtCOP(reduccionIntereses);
        byId('simMesesReducidos').textContent = `${mesesReducidos} mes(es)`;
        byId('simFechaSinAbonos').textContent = simulacionBase.fechaFinTexto;
        byId('simFechaConAbonos').textContent = simulacionConAbonos.fechaFinTexto;

        if (warningBox) {
          const mensajes = comparativo.warnings || [];
          if (mensajes.length > 0) {
            warningBox.textContent = mensajes.join(' ');
            warningBox.style.display = 'block';
          } else {
            warningBox.textContent = '';
            warningBox.style.display = 'none';
          }
        }
      }

      window.actualizarSimulacion = function() {
        const obId = byId('simulacionObligacion').value;
        const base = Math.max(0, Number(byId('simulacionAbono').value) || 0);
        const ob = obligaciones.find(o => o.id === obId);
        if (!ob) return;

        const rBase = compararEscenariosAbonoConstante(ob, base);
        byId('simBaseAbono').textContent = formatearAbonoSimulador(ob, base, rBase);
        byId('simBasePlazo').textContent = rBase.simulacionConAbonos.meses;
        byId('simBaseAhorro').textContent = fmtCOP(rBase.ahorroTotal);

        const r25 = compararEscenariosAbonoConstante(ob, base * 1.25);
        byId('sim25Abono').textContent = formatearAbonoSimulador(ob, base * 1.25, r25);
        byId('sim25Plazo').textContent = r25.simulacionConAbonos.meses;
        byId('sim25Ahorro').textContent = fmtCOP(r25.ahorroTotal);

        const r50 = compararEscenariosAbonoConstante(ob, base * 1.5);
        byId('sim50Abono').textContent = formatearAbonoSimulador(ob, base * 1.5, r50);
        byId('sim50Plazo').textContent = r50.simulacionConAbonos.meses;
        byId('sim50Ahorro').textContent = fmtCOP(r50.ahorroTotal);

        actualizarSimulacionPersonalizada();
      };

      window.actualizarSimulacionPersonalizada = function() {
        const obId = byId('simulacionObligacion').value;
        const base = Math.max(0, Number(byId('simulacionAbono').value) || 0);
        const pct = Number(byId('simulacionPorcentaje').value) / 100;
        const ob = obligaciones.find(o => o.id === obId);
        if (!ob) return;

        const abonoCustom = base * (1 + pct);
        const comparativo = compararEscenariosAbonoConstante(ob, abonoCustom);
        
        byId('simulacionPorcentajeValor').textContent = `${Math.round(pct * 100)}%`;
        const porcentajeCustom = byId('porcentajeCustom');
        porcentajeCustom.textContent = `${Math.round(pct * 100)}%`;
        
        if (pct <= 0.25) porcentajeCustom.style.background = 'var(--color-primary)';
        else if (pct <= 0.5) porcentajeCustom.style.background = 'var(--color-warning)';
        else if (pct <= 0.75) porcentajeCustom.style.background = 'var(--color-secondary)';
        else porcentajeCustom.style.background = 'var(--color-accent)';
        
        byId('simCustomAbono').textContent = formatearAbonoSimulador(ob, abonoCustom, comparativo);
        byId('simCustomPlazo').textContent = comparativo.simulacionConAbonos.meses;
        byId('simCustomAhorro').textContent = fmtCOP(comparativo.ahorroTotal);
        actualizarResumenComparativoSimulador(ob, comparativo);
      };

      window.aplicarSimulacion = function() {
        const obId = byId('simulacionObligacion').value;
        const base = Math.max(0, Number(byId('simulacionAbono').value) || 0);
        const pct = Number(byId('simulacionPorcentaje').value) / 100;
        const input = byId(`abono_${obId}`);
        const valor = Math.round(base * (1 + pct));
        
        if (input) {
          input.value = valor;
          input.classList.add('highlight-pulse');
          setTimeout(() => input.classList.remove('highlight-pulse'), 1000);
          
          const card = document.querySelector(`[data-id="${obId}"]`);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        cerrarSimulador();
        notificar(`✅ Abono de ${fmtCOP(valor)} listo para aplicar`, 'success');
      };

      /* ========= EXPORTAR A EXCEL ========= */
      function exportarAExcel() {
        if (obligacionesCerradas.length === 0) {
          notificar('No hay historial para exportar', 'warning');
          return;
        }

        try {
          const datosExcel = obligacionesCerradas.map(c => {
            const cerrada = normalizarObligacionCerrada(c);
            return ({
            'Entidad': c.entidad || 'N/A',
            'Tipo de crédito': c.tipoCredito || 'N/A',
            'Moneda': c.moneda || 'COP',
            'Fecha de cierre': c.fechaCierre || 'N/A',
            'Valor crédito original': c.moneda === 'UVR' ? c.valorCreditoOriginal?.toFixed(2) + ' UVR' : fmtCOP(c.valorCreditoOriginal || 0),
            'Saldo final': c.moneda === 'UVR' ? c.saldoFinal?.toFixed(2) + ' UVR' : fmtCOP(c.saldoFinal || 0),
            'Tasa EA %': c.interesEA || 0,
            'Número de abonos': c.numeroAbonos || 0,
            'Total abonado': fmtCOP(cerrada.totalAbonosCOP || cerrada.totalAbonos || 0),
            'Intereses ahorrados': fmtCOP(cerrada.interesesDejadosDePagarCOP || cerrada.interesesDejadosDePagar || 0),
            'Cuotas evitadas': c.cuotasDejadasDePagar || 0,
            'Meses ahorrados total': c.mesesAhorradosTotal || 0
            });
          });

          const wb = XLSX.utils.book_new();
          const ws = XLSX.utils.json_to_sheet(datosExcel);
          
          const colWidths = [
            { wch: 20 }, { wch: 15 }, { wch: 8 }, { wch: 20 }, { wch: 18 },
            { wch: 18 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 18 },
            { wch: 12 }, { wch: 15 }
          ];
          ws['!cols'] = colWidths;

          XLSX.utils.book_append_sheet(wb, ws, 'Historial');
          
          const fecha = hoyISO();
          XLSX.writeFile(wb, `historial-bola-nieve-${fecha}.xlsx`);
          
          notificar('📥 Historial exportado a Excel correctamente', 'success');
        } catch (error) {
          console.error('Error al exportar a Excel:', error);
          notificar('❌ Error al exportar a Excel', 'warning');
        }
      }

      /* ========= UTILIDADES ========= */
      function verificarRecordatorios() {
        const hoy = new Date();
        obligaciones.forEach(ob => {
          if (ob.saldoActual <= 0) return;
          const vto = new Date(ob.fechaProximoVencimiento + 'T00:00:00');
          const dias = Math.ceil((vto - hoy) / (1000 * 60 * 60 * 24));
          if (dias > 0 && dias <= 3) {
            notificar(`🔔 Vence ${ob.entidad} en ${dias} día(s)`, 'info');
          }
        });
      }

      function construirProyeccionCuotaUVR(ob) {
        const warnings = [];
        const contexto = obtenerContextoUVR(ob, warnings);
        const mesesRestantes = Math.max(0, Number(ob.cantidadCuotas || 0) - Number(ob.numeroCuota || 0) + 1);
        const proyeccion = simularPlanPagosUVR({
          saldoInicialUVR: Number(ob.saldoActual || 0),
          tasaEARealDec: parsePctToDec(ob.interesEA),
          cuotaUVR: Number(ob.valorCuota || 0),
          inflacionEsperadaEA: contexto.inflacionEsperadaEA,
          valorUVRBase: contexto.valorUVRBase,
          fechaUVRBase: contexto.fechaUVRBase,
          fechaInicio: ob.fechaProximoVencimiento || addMonthsIso(hoyISO(), 1),
          incluirDetalle: true,
          maxMeses: Math.max(12, mesesRestantes)
        });

        return {
          ...proyeccion,
          warnings: [...warnings, ...(proyeccion.warnings || [])]
        };
      }

      window.abrirProyeccionUVR = function(id) {
        const ob = obligaciones.find((item) => item.id === id);
        if (!ob || !esCreditoUVR(ob)) return;

        const proyeccion = construirProyeccionCuotaUVR(ob);
        const modal = byId('modalProyeccionUVR');
        const resumen = byId('proyeccionUVRResumen');
        const body = byId('proyeccionUVRBody');

        resumen.innerHTML = `
          <div class="card">
            <div class="text-muted">Saldo actual</div>
            <strong>${formatearDualUVR(ob.saldoActual, obtenerSaldoActualCOP(ob))}</strong>
          </div>
          <div class="card">
            <div class="text-muted">Cuota fija UVR</div>
            <strong>${fmtUVR(ob.valorCuota)}</strong>
          </div>
          <div class="card">
            <div class="text-muted">Inflacion usada</div>
            <strong>${Number(ob.uvr?.inflacionEsperadaEA || UVR_CONFIG.DEFAULT_INFLATION_EA).toFixed(2)}% EA</strong>
          </div>
        `;

        body.innerHTML = (proyeccion.detalle || []).map((fila) => `
          <tr>
            <td>${fila.mes}</td>
            <td>${fila.fecha}</td>
            <td>${fila.valorUVR.toFixed(4)}</td>
            <td>${fmtUVR(fila.cuotaUVR)}</td>
            <td>${fmtCOP(fila.cuotaCOP)}</td>
          </tr>
        `).join('');

        const chartCanvas = byId('graficoProyeccionUVR');
        const chartCtx = chartCanvas?.getContext('2d');
        if (graficoProyeccionUVR) graficoProyeccionUVR.destroy();
        if (chartCtx) {
          graficoProyeccionUVR = new Chart(chartCtx, {
            type: 'line',
            data: {
              labels: (proyeccion.detalle || []).map((fila) => `Mes ${fila.mes}`),
              datasets: [{
                label: 'Cuota en pesos',
                data: (proyeccion.detalle || []).map((fila) => fila.cuotaCOP),
                borderColor: '#1F4E79',
                backgroundColor: 'rgba(31, 78, 121, 0.08)',
                fill: true,
                tension: 0.25
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    label: (ctx) => fmtCOP(ctx.raw)
                  }
                }
              }
            }
          });
        }

        modal.style.display = 'flex';
      };

      window.cerrarProyeccionUVR = function() {
        byId('modalProyeccionUVR').style.display = 'none';
      };

      function setValorMonedaFormulario(id, valor) {
        const input = byId(id);
        if (!input) return;

        if (!esNumeroFinito(valor) || Number(valor) <= 0) {
          input.value = '';
          input.dataset.raw = '';
          return;
        }

        const entero = Math.round(Number(valor));
        input.dataset.raw = String(entero);
        input.value = new Intl.NumberFormat('es-CO', {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0
        }).format(entero);
      }

      function actualizarEstadoFormularioObligacion() {
        const editando = Boolean(obligacionEditandoId);
        const titulo = byId('formObligacionTitle');
        const descripcion = byId('formObligacionModeText');
        const textoBoton = byId('formSubmitText');
        const btnCancelar = byId('btnCancelarEdicion');

        if (titulo) titulo.innerHTML = editando
          ? '<i class="fas fa-pen"></i> Editar obligación'
          : '<i class="fas fa-plus-circle"></i> Crear nueva obligación';
        if (descripcion) {
          descripcion.textContent = editando
            ? 'Estás editando una obligación existente. Al guardar recalcularemos saldo, cuota y plazo.'
            : 'Registra una nueva obligación para empezar a seguir su progreso.';
          descripcion.classList.toggle('hidden', false);
        }
        if (textoBoton) textoBoton.textContent = editando ? 'Guardar cambios' : 'Crear obligación';
        if (btnCancelar) btnCancelar.classList.toggle('hidden', !editando);
      }

      function cargarObligacionEnFormulario(id) {
        const ob = obligaciones.find((item) => item.id === id);
        if (!ob) return;

        obligacionEditandoId = id;
        byId('entidadSelect').value = ob.entidad || '';
        byId('tipoCredito').value = ob.tipoCredito || '';
        byId('fechaVencimiento').value = toIsoDate(ob.fechaProximoVencimiento || hoyISO(), hoyISO());
        byId('interesEA').value = Number(ob.interesEA || 0);
        byId('numeroCuota').value = Number(ob.numeroCuota || 1);
        byId('cantidadCuotas').value = Number(ob.cantidadCuotas || 1);
        byId('penalidadPrepago').value = Number(ob.penalidadPrepagoPct || 0) || '';

        const esUVR = esCreditoUVR(ob);
        seleccionarMoneda(esUVR ? 'UVR' : 'COP');
        actualizarVisibilidadCamposUVR();

        if (esUVR) {
          const valorUVRBase = sanearValorUvr(ob?.uvr?.valorUVRBase || ob?.uvr?.valorUVRActual || uvrActual);
          byId('fechaDesembolsoUVR').value = toIsoDate(ob?.uvr?.fechaDesembolso || hoyISO(), hoyISO());
          byId('inflacionEsperadaEA').value = Number(ob?.uvr?.inflacionEsperadaEA ?? UVR_CONFIG.DEFAULT_INFLATION_EA);
          byId('uvrManual').value = roundTo(valorUVRBase, 4).toFixed(4);
          setValorMonedaFormulario('valorCredito', obtenerSaldoEdicionCOP(ob));
          const cuotaEstimadaCOP = roundTo(uvrToCop(Number(ob.valorCuota || 0), valorUVRBase), 2);
          setValorMonedaFormulario('valorCuota', cuotaEstimadaCOP);
        } else {
          setValorMonedaFormulario('valorCredito', Number(ob.saldoActual || 0));
          setValorMonedaFormulario('valorCuota', Number(ob.valorCuota || 0));
          byId('fechaDesembolsoUVR').value = '';
          byId('inflacionEsperadaEA').value = UVR_CONFIG.DEFAULT_INFLATION_EA;
          byId('uvrManual').value = roundTo(uvrActual, 4).toFixed(4);
        }

        actualizarResumenUVRFormulario();
        actualizarEstadoFormularioObligacion();

        const formularioCard = byId('formObligacion')?.closest('.card');
        formularioCard?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }

      function renderizarAjusteDashboard() {
        const contenedor = byId('dashboardDeletionImpact');
        if (!contenedor) return;

        const ajuste = ultimoAjusteDashboard;
        const tieneImpacto = ajuste && (ajuste.metricas?.intereses > 0 || ajuste.metricas?.capital > 0 || ajuste.metricas?.cuotas > 0);

        if (!tieneImpacto) {
          contenedor.classList.add('hidden');
          contenedor.innerHTML = '';
          return;
        }

        contenedor.classList.remove('hidden');
        contenedor.innerHTML = `
          <div class="dashboard-adjustment-copy">
            <strong>Ajuste por eliminación:</strong> ${ajuste.entidad} salió del dashboard y estos acumulados se descontaron.
          </div>
          <div class="dashboard-adjustment-chips">
            ${ajuste.metricas.intereses > 0 ? `<span class="dashboard-adjustment-chip">-${fmtCOP(ajuste.metricas.intereses)} en intereses</span>` : ''}
            ${ajuste.metricas.capital > 0 ? `<span class="dashboard-adjustment-chip">-${fmtCOP(ajuste.metricas.capital)} en capital</span>` : ''}
            ${ajuste.metricas.cuotas > 0 ? `<span class="dashboard-adjustment-chip">-${ajuste.metricas.cuotas} cuota(s)</span>` : ''}
          </div>
          <button type="button" class="dashboard-adjustment-close" onclick="cerrarAjusteDashboard()">&times;</button>
        `;
      }

      function abrirModalEliminarObligacion(id) {
        const ob = obligaciones.find((item) => item.id === id);
        const modal = byId('modalEliminarObligacion');
        const detalle = byId('detalleEliminarObligacion');
        if (!ob || !modal || !detalle) return;

        obligacionPendienteEliminarId = id;
        const metricas = obtenerMetricasObligacionActiva(ob);
        const chips = [
          metricas.intereses > 0 ? `Intereses a descontar: ${fmtCOP(metricas.intereses)}` : '',
          metricas.capital > 0 ? `Capital a descontar: ${fmtCOP(metricas.capital)}` : '',
          metricas.cuotas > 0 ? `Cuotas a descontar: ${metricas.cuotas}` : ''
        ].filter(Boolean);

        detalle.innerHTML = `
          <strong>${ob.entidad}</strong> (${ob.tipoCredito}) se eliminará de la lista activa.
          ${chips.length > 0 ? `<div class="delete-impact-list">${chips.map((chip) => `<span class="delete-impact-chip">${chip}</span>`).join('')}</div>` : ''}
        `;
        modal.style.display = 'flex';
      }

      function cerrarModalEliminarObligacion() {
        obligacionPendienteEliminarId = null;
        const modal = byId('modalEliminarObligacion');
        if (modal) modal.style.display = 'none';
      }

      function eliminarObligacionConfirmada() {
        const id = obligacionPendienteEliminarId;
        const ob = obligaciones.find((item) => item.id === id);
        if (!ob) {
          cerrarModalEliminarObligacion();
          return;
        }

        const metricasEliminadas = obtenerMetricasObligacionActiva(ob);
        obligaciones = obligaciones.filter((item) => item.id !== id);

        if (obligacionEditandoId === id) {
          limpiarFormularioObligacion();
        }

        ultimoAjusteDashboard = (metricasEliminadas.intereses > 0 || metricasEliminadas.capital > 0 || metricasEliminadas.cuotas > 0)
          ? { entidad: ob.entidad, metricas: metricasEliminadas, fecha: new Date().toISOString() }
          : null;

        guardarDatos();
        renderizarTodo();
        cerrarModalEliminarObligacion();

        notificar(`🗑️ ${ob.entidad} fue eliminada correctamente`, 'success');
      }

      window.editarObligacion = cargarObligacionEnFormulario;
      window.solicitarEliminarObligacion = abrirModalEliminarObligacion;
      window.cerrarModalEliminarObligacion = cerrarModalEliminarObligacion;
      window.confirmarEliminarObligacion = eliminarObligacionConfirmada;
      window.cerrarAjusteDashboard = function() {
        ultimoAjusteDashboard = null;
        renderizarAjusteDashboard();
      };

      function renderizarTodo() {
        renderObligaciones();
        renderCerradas();
        actualizarDashboard();
        renderizarGrafico();
        renderizarLogros();
        actualizarOfertas();
      }

      function construirObligacionDesdeFormulario() {
        const tipoCredito = byId('tipoCredito').value;
        const moneda = tipoCredito === 'vivienda' ? monedaSeleccionada : 'COP';
        const base = {
          id: obligacionEditandoId || crypto.randomUUID(),
          entidad: byId('entidadSelect').value,
          tipoCredito,
          moneda,
          fechaProximoVencimiento: byId('fechaVencimiento').value || hoyISO(),
          interesEA: Number(byId('interesEA').value),
          numeroCuota: Number(byId('numeroCuota').value),
          cantidadCuotas: Number(byId('cantidadCuotas').value),
          cantidadCuotasOriginal: Number(byId('cantidadCuotas').value),
          cuotaInicial: Number(byId('numeroCuota').value),
          penalidadPrepagoPct: Number(byId('penalidadPrepago').value || 0),
          historicoAbonos: [],
          creadoAt: new Date().toISOString()
        };

        if (moneda !== 'UVR') {
          const valorCredito = getInputMoneyValue('valorCredito');
          const valorCuota = getInputMoneyValue('valorCuota');
          return {
            ...base,
            valorCredito,
            valorCuota,
            saldoActual: valorCredito
          };
        }

        const resumen = construirResumenUVRDesdeFormulario();
        return normalizarObligacionUVR({
          ...base,
          valorCredito: resumen.saldoActualUVR,
          valorCuota: resumen.cuotaUVR,
          saldoActual: resumen.saldoActualUVR,
          uvr: {
            origen: uvrFuenteActual,
            fechaDesembolso: resumen.fechaDesembolso,
            fechaUVRBase: resumen.fechaUVRBase,
            valorUVRBase: resumen.valorUVRBase,
            valorUVRActual: resumen.valorUVRBase,
            inflacionEsperadaEA: resumen.inflacionEsperadaEA,
            cuotaUVR: resumen.cuotaUVR,
            saldoActualUVR: resumen.saldoActualUVR,
            saldoActualCOP: resumen.valorCreditoCOP,
            cuotaPesosEstimada: resumen.cuotaCOPPrimerMes,
            advertencias: resumen.warnings
          }
        });
      }

      function construirObligacionEditada(obAnterior, obligacionFormulario) {
        const evaluacionHistorico = evaluarPreservacionHistoricoEdicion(obAnterior, obligacionFormulario);
        const historicoAbonos = evaluacionHistorico.preserve ? (obAnterior.historicoAbonos || []) : [];

        const obligacionEditada = normalizarObligacionUVR({
          ...obligacionFormulario,
          id: obAnterior.id,
          historicoAbonos,
          creadoAt: obAnterior.creadoAt || obligacionFormulario.creadoAt || new Date().toISOString(),
          cantidadCuotasOriginal: obligacionFormulario.cantidadCuotas,
          cuotaInicial: obligacionFormulario.numeroCuota
        });

        return {
          obligacion: obligacionEditada,
          evaluacionHistorico
        };
      }

      function validarObligacionFormulario(obligacion) {
        const errors = [];
        if (!obligacion.entidad) errors.push('Entidad requerida');
        if (!obligacion.tipoCredito) errors.push('Tipo de credito requerido');
        if ((Number(obligacion.interesEA) || 0) < 0 || (Number(obligacion.interesEA) || 0) > 60) errors.push('Interes EA entre 0% y 60%');
        if ((Number(obligacion.numeroCuota) || 0) < 1) errors.push('Numero de cuota debe ser mayor o igual a 1');
        if ((Number(obligacion.cantidadCuotas) || 0) < (Number(obligacion.numeroCuota) || 0)) errors.push('Total de cuotas debe ser mayor o igual a la cuota actual');

        if (esCreditoUVR(obligacion)) {
          if ((Number(obligacion.saldoActual) || 0) <= 0) errors.push('El saldo UVR calculado debe ser mayor a cero');
          if ((Number(obligacion.valorCuota) || 0) <= 0) errors.push('La cuota UVR calculada debe ser mayor a cero');
          if ((Number(obligacion.uvr?.valorUVRBase) || 0) < UVR_CONFIG.MIN_UVR_VALUE) errors.push('La UVR base debe ser valida');
        } else {
          if ((Number(obligacion.valorCredito) || 0) <= 0) errors.push('Valor del credito debe ser mayor a cero');
          if ((Number(obligacion.valorCuota) || 0) <= 0) errors.push('Valor de cuota debe ser mayor a cero');
        }

        return errors;
      }

      function limpiarFormularioObligacion() {
        byId('formObligacion').reset();
        ['valorCredito', 'valorCuota'].forEach((id) => {
          const input = byId(id);
          if (input) {
            input.value = '';
            input.dataset.raw = '';
          }
        });
        ['equivalenciaCreditoUVR', 'cuotaCalculadaUVR', 'cuotaEstimadaCOPUVR'].forEach((id) => {
          if (byId(id)) byId(id).value = '';
        });
        const uvrManual = byId('uvrManual');
        if (uvrManual) uvrManual.value = roundTo(uvrActual, 4).toFixed(4);
        if (byId('inflacionEsperadaEA')) byId('inflacionEsperadaEA').value = UVR_CONFIG.DEFAULT_INFLATION_EA;
        obligacionEditandoId = null;
        monedaSeleccionada = 'COP';
        actualizarVisibilidadCamposUVR();
        actualizarEstadoFormularioObligacion();
      }

      /* ========= EVENT LISTENERS ========= */
      function inicializarEventListeners() {
        ['valorCredito', 'valorCuota'].forEach((id) => {
          const input = byId(id);
          if (!input || input.dataset.formattedBound === 'true') return;
          input.dataset.formattedBound = 'true';
          input.addEventListener('input', () => formatInputMiles(input));
          input.addEventListener('blur', () => formatInputMiles(input));
        });

        byId('formObligacion').addEventListener('submit', (e) => {
          e.preventDefault();
          const obligacionFormulario = construirObligacionDesdeFormulario();

          const errors = validarObligacionFormulario(obligacionFormulario);
          if (!obligacionFormulario.entidad) errors.push('Entidad requerida');
          if (!obligacionFormulario.tipoCredito) errors.push('Tipo de crédito requerido');
          if (obligacionFormulario.valorCredito <= 0 && obligacionFormulario.moneda !== 'UVR') errors.push('Valor del crédito debe ser > 0');
          if (obligacionFormulario.valorCuota <= 0 && obligacionFormulario.moneda !== 'UVR') errors.push('Valor cuota debe ser > 0');
          if (obligacionFormulario.interesEA < 0 || obligacionFormulario.interesEA > 60) errors.push('Interés entre 0% y 60%');
          if (obligacionFormulario.numeroCuota < 1) errors.push('Numero de cuota debe ser ≥ 1');
          if (obligacionFormulario.cantidadCuotas < obligacionFormulario.numeroCuota) {
            errors.push('Cantidad cuotas debe ser ≥ número actual');
          }

          const erroresUnicos = [...new Set(errors)];
          if (erroresUnicos.length > 0) {
            alert('Errores:\n- ' + erroresUnicos.join('\n- '));
            return;
          }

          if (obligacionEditandoId) {
            const actual = obligaciones.find((ob) => ob.id === obligacionEditandoId);
            if (!actual) {
              notificar('No encontramos la obligación que estabas editando. Intenta de nuevo.', 'warning');
              limpiarFormularioObligacion();
              return;
            }

            const { obligacion, evaluacionHistorico } = construirObligacionEditada(actual, obligacionFormulario);
            obligaciones = obligaciones.map((ob) => ob.id === actual.id ? obligacion : ob);

            guardarDatos();
            renderizarTodo();
            limpiarFormularioObligacion();

            if (evaluacionHistorico.preserve) {
              notificar(`✅ ${obligacion.entidad} fue actualizada y su histórico de abonos se conservó`, 'success');
            } else if ((actual.historicoAbonos || []).length > 0) {
              const porcentajeCambio = Math.round((evaluacionHistorico.ratio || 0) * 100);
              notificar(`⚠️ ${obligacion.entidad} fue actualizada. El histórico se reinició porque el saldo cambió ${porcentajeCambio}%`, 'warning');
            } else {
              notificar(`✅ ${obligacion.entidad} fue actualizada correctamente`, 'success');
            }
            return;
          }

          obligaciones.push(obligacionFormulario);
          guardarDatos();
          renderizarTodo();
          limpiarFormularioObligacion();
          
          notificar(`✅ Obligación creada correctamente en ${obligacionFormulario.moneda}`, 'success');
        });

        byId('btnAgregarEntidad').addEventListener('click', () => {
          const nombre = prompt('Ingresa el nombre de la nueva entidad:');
          if (nombre && nombre.trim().length > 1) {
            entidadesListado.push(nombre.trim());
            localStorage.setItem(STORAGE_KEYS.ENTIDADES, JSON.stringify(entidadesListado));
            cargarEntidades();
            notificar(`✅ Entidad "${nombre}" agregada`, 'success');
          }
        });

        byId('btnOrdenSnowball').addEventListener('click', () => {
          ordenMetodo = 'snowball';
          renderObligaciones();
          notificar('Ordenado por Bola de Nieve (menor saldo)', 'info');
        });
        
        byId('btnOrdenAvalancha').addEventListener('click', () => {
          ordenMetodo = 'avalancha';
          renderObligaciones();
          notificar('Ordenado por Avalancha (mayor tasa)', 'info');
        });

        byId('btnExportarCerradasXLSX').addEventListener('click', exportarAExcel);
        byId('btnCancelarEdicion')?.addEventListener('click', limpiarFormularioObligacion);

        byId('comparadorTipo').addEventListener('change', actualizarOfertas);
        byId('btnBuscarOfertas').addEventListener('click', actualizarOfertas);
        
        byId('simulacionObligacion').addEventListener('change', actualizarLabelSimulador);
        byId('btnConsultarUVR')?.addEventListener('click', () => consultarUVRActual());
        ['tipoCredito', 'fechaVencimiento', 'interesEA', 'numeroCuota', 'cantidadCuotas', 'inflacionEsperadaEA', 'fechaDesembolsoUVR'].forEach((id) => {
          byId(id)?.addEventListener('input', actualizarResumenUVRFormulario);
          byId(id)?.addEventListener('change', actualizarResumenUVRFormulario);
        });
        byId('uvrManual')?.addEventListener('input', () => {
          const valor = Number(byId('uvrManual').value);
          if (Number.isFinite(valor) && valor > 0) {
            uvrActual = valor;
            uvrFuenteActual = 'manual';
          }
          renderizarValorUVRActual();
          actualizarResumenUVRFormulario();
        });
        seleccionarMoneda('COP');
        actualizarEstadoFormularioObligacion();
      }

      window.notificar = notificar;
      window.filtrarPorMetrica = (tipo) => {
        notificar(`Filtro por ${tipo} disponible próximamente`, 'info');
      };
      window.cambiarVistaGrafico = (vista) => {
        vistaGraficoActual = vista === 'mensual' ? 'mensual' : 'acumulado';
        renderizarGrafico();
      };
      window.refrescarGraficoManual = () => {
        renderizarGrafico();
        notificar('Grafico reconstruido correctamente', 'success');
      };
      window.lanzarConfeti = lanzarConfeti;

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', inicializar);
      } else {
        inicializar();
      }
    })();

  // ========= MODALES DE INFORMACIÓN LEGAL =========
function abrirModalLegal(tipo) {
  const contenidos = {
    terminos: `
      <h2>📜 TÉRMINOS DE USO</h2>
      <p class="fecha"><strong>Última actualización:</strong> Marzo 2026</p>
      
      <div class="destacado">
        <p><strong>Al usar Bola de Nieve, aceptas estos términos.</strong> La herramienta es educativa y no constituye asesoría financiera profesional.</p>
      </div>
      
      <h3>1. Aceptación de términos</h3>
      <p>Al acceder y usar Bola de Nieve, aceptas cumplir con estos términos de uso. Si no estás de acuerdo, no uses la aplicación.</p>
      
      <h3>2. Uso de la información</h3>
      <p>Tus datos se guardan <strong>LOCALMENTE en tu navegador</strong> (localStorage). No tenemos acceso a tu información financiera real a menos que nos la compartas voluntariamente. No enviamos datos a servidores externos.</p>
      
      <h3>3. Precisión de cálculos</h3>
      <p>Los cálculos son aproximados y pueden variar respecto a los intereses reales cobrados por entidades financieras. Verifica siempre con tu banco. Esta herramienta es para fines educativos y de simulación.</p>
      
      <h3>4. Responsabilidad del usuario</h3>
      <p>Eres responsable de tus decisiones financieras. Recomendamos consultar con un asesor profesional antes de tomar decisiones importantes basadas en estas simulaciones.</p>
      
      <h3>5. Propiedad intelectual</h3>
      <p>El código, diseño y contenido de Bola de Nieve son propiedad de Cristian Piamba. No está permitida la copia o distribución sin autorización.</p>
     
       <h3>6. Modificaciones</h3>
      <p>Nos reservamos el derecho de modificar estos términos en cualquier momento. Los cambios serán efectivos inmediatamente después de su publicación.</p>
      
      <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--color-border); text-align: center; color: var(--color-muted);">
        © 2026 Bola de Nieve - Todos los derechos reservados
      </p>
    `,
    
    privacidad: `
      <h2>🔒 POLÍTICA DE PRIVACIDAD</h2>
      <p class="fecha"><strong>Última actualización:</strong> Marzo 2026</p>
      
      <div class="destacado">
        <p><strong>Tu privacidad es primero.</strong> Esta app funciona 100% en tu navegador. No recopilamos, almacenamos ni compartimos tu información personal.</p>
      </div>
      
      <h3>📊 Datos que guardamos (localmente)</h3>
      <p>✓ Tus obligaciones financieras (solo en tu dispositivo)<br>
      ✓ Historial de abonos (solo en tu dispositivo)<br>
      ✓ Preferencias de ordenamiento (solo en tu dispositivo)<br>
      ✓ Logros desbloqueados (solo en tu dispositivo)</p>
      
      <h3>🚫 Datos que NO guardamos</h3>
      <p>✗ No enviamos nada a servidores externos<br>
      ✗ No rastreamos tu actividad<br>
      ✗ No usamos cookies de seguimiento<br>
      ✗ No compartimos información con terceros<br>
      ✗ No tenemos acceso a tus datos bancarios reales</p>
      
      <h3>💾 Tecnología</h3>
      <p>Usamos <strong>localStorage</strong> del navegador. Puedes borrar tus datos en cualquier momento:</p>
      <p>• Chrome: Configuración → Privacidad → Borrar datos de navegación<br>
      • Firefox: Opciones → Privacidad → Limpiar datos<br>
      • Edge: Configuración → Privacidad → Borrar datos</p>
      
      <h3>📧 Contacto</h3>
      <p>Si tienes preguntas sobre privacidad: <strong>privacidad@boladenieve.com</strong></p>
      
      <p style="margin-top: 30px; padding: 15px; background: var(--color-warning-light); border-radius: var(--radius-md);">
        <i class="fas fa-shield-alt" style="color: var(--color-warning);"></i>
        <strong>100% local · 100% privado · 100% tuyo</strong>
      </p>
    `,
    
    legal: `
      <h2>⚖️ AVISO LEGAL</h2>
      <p class="fecha"><strong>Última actualización:</strong> Marzo 2026</p>
      
      <h3>🎓 Propósito educativo</h3>
      <p><strong>Bola de Nieve</strong> es una herramienta educativa para simular estrategias de pago de deudas. No somos una entidad financiera, ni ofrecemos asesoría profesional, ni intermediamos créditos.</p>
      
      <h3>⚠️ Limitación de responsabilidad</h3>
      <p>El usuario es el único responsable de sus decisiones financieras. Las simulaciones son aproximadas y pueden no coincidir exactamente con los cálculos reales de las entidades financieras. Recomendamos:</p>
      <p>✓ Verificar siempre con tu banco los intereses reales<br>
      ✓ Consultar con un asesor financiero certificado<br>
      ✓ Leer la letra pequeña de tus contratos</p>
      
      <h3>📋 Exactitud de la información</h3>
      <p>Hacemos nuestro mejor esfuerzo por mantener cálculos precisos, pero los intereses pueden variar según la entidad, el tipo de crédito y las políticas vigentes. Verifica con tu extracto bancario.</p>
      
      <h3>©️ Propiedad intelectual</h3>
      <p>Código fuente, diseño, logo y contenido © 2026 <strong>Cristian Piamba</strong>. Todos los derechos reservados. Prohibida la reproducción total o parcial sin autorización escrita.</p>
      
      <h3>📞 Contacto legal</h3>
      <p>Para asuntos legales: <strong>legal@boladenieve.com</strong></p>
      
      <p style="margin-top: 30px; padding: 20px; background: var(--color-primary-light); border-radius: var(--radius-md); text-align: center;">
        <i class="fas fa-gavel" style="color: var(--color-primary);"></i>
        <strong>Radicado: </strong> BDN-LEGAL-2026-001
      </p>
    `,
    
    contacto: `
       <h2>📧 CONTÁCTANOS</h2>
      
      <div class="contacto-info">
        <div class="contacto-avatar">
          <i class="fas fa-user"></i>
        </div>
        <div class="contacto-datos">
          <h3>Cristian Piamba</h3>
          <p><i class="fas fa-code"></i> Creador de Bola de Nieve</p>
          <p><i class="fas fa-map-marker-alt"></i> Colombia</p>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 25px;">
        <div style="padding: 15px; background: var(--color-primary-light); border-radius: var(--radius-md); text-align: center;">
          <i class="fas fa-envelope" style="font-size: 24px; color: var(--color-primary); margin-bottom: 8px;"></i>
          <p style="font-weight: 600;">Email</p>
          <p style="font-size: 13px;">cristian@boladenieve.com</p>
        </div>
        <div style="padding: 15px; background: var(--color-secondary-light); border-radius: var(--radius-md); text-align: center;">
          <i class="fas fa-phone" style="font-size: 24px; color: var(--color-secondary); margin-bottom: 8px;"></i>
          <p style="font-weight: 600;">Teléfono</p>
          <p style="font-size: 13px;">+57 123 456 7890</p>
        </div>
      </div>
      
      <div class="contacto-redes" style="justify-content: center; margin-bottom: 25px;">
        <a href="#"><i class="fab fa-facebook-f"></i></a>
        <a href="#"><i class="fab fa-twitter"></i></a>
        <a href="#"><i class="fab fa-linkedin-in"></i></a>
        <a href="#"><i class="fab fa-instagram"></i></a>
        <a href="#"><i class="fab fa-github"></i></a>
      </div>
      
      <h3 style="margin: 25px 0 15px;">Envíanos un mensaje</h3>
      
      <form class="modal-contacto-form" onsubmit="enviarMensajeContacto(event)">
        <div class="form-group">
          <input type="text" placeholder="Tu nombre" id="contactoNombre" required>
        </div>
        <div class="form-group">
          <input type="email" placeholder="Tu email" id="contactoEmail" required>
        </div>
        <div class="form-group">
          <input type="text" placeholder="Asunto" id="contactoAsunto" required>
        </div>
        <div class="form-group">
          <textarea placeholder="Tu mensaje" id="contactoMensaje" rows="4" required></textarea>
        </div>
        <button type="submit" class="btn btn-primary">
          <i class="fas fa-paper-plane"></i> Enviar mensaje
        </button>
      </form>
    `
  };
  
  document.getElementById('modalLegalContenido').innerHTML = contenidos[tipo];
  document.getElementById('modalLegal').style.display = 'flex';
}

function cerrarModalLegal() {
  document.getElementById('modalLegal').style.display = 'none';
}

function enviarMensajeContacto(event) {
  event.preventDefault();
  
  const nombre = document.getElementById('contactoNombre')?.value || '';
  const email = document.getElementById('contactoEmail')?.value || '';
  const asunto = document.getElementById('contactoAsunto')?.value || '';
  const mensaje = document.getElementById('contactoMensaje')?.value || '';
  
  notificar(`✅ Mensaje enviado (demo)\nGracias ${nombre}, te contactaremos pronto.`, 'success');
  cerrarModalLegal();
}

document.addEventListener('keydown', function(event) {
  if (event.key === 'Escape') {
    cerrarModalLegal();
  }
});  

(() => {
  "use strict";

  const AUTH_KEYS = {
    USERS: "bdn_users",
    SESSION: "bdn_session",
    PROVIDER: "bdn_provider"
  };

  const APP_CONFIG = {
    googleClientId: window.APP_CONFIG?.googleClientId || "",
    adminEmails: (window.APP_CONFIG?.adminEmails || []).map((email) => String(email).trim().toLowerCase())
  };

  const SESSION_TIMEOUTS = {
    standard: 15 * 24 * 60 * 60 * 1000,
    admin: 30 * 60 * 1000
  };

  let users = [];
  let currentUser = null;
  let currentSession = null;
  let googleReady = false;
  let sessionTimer = null;
  let lastActivityTouch = 0;

  const byId = (id) => document.getElementById(id);
  const notify = (message, type = "info") => typeof window.notificar === "function" ? window.notificar(message, type) : undefined;
  const normalizeEmail = (value) => String(value || "").trim().toLowerCase();
  const isDevelopmentAuthContext = () => {
    const host = window.location.hostname || "";
    return window.location.protocol === "file:" || host === "localhost" || host === "127.0.0.1";
  };
  const getGoogleButtonWidth = () => {
    const slot = byId("googleLoginContainer");
    const slotWidth = Math.floor(slot?.getBoundingClientRect?.().width || 0);
    if (!slotWidth) return 320;
    return Math.max(260, Math.min(420, Math.floor(slotWidth * 0.92)));
  };

  function loadUsers() {
    try {
      users = JSON.parse(localStorage.getItem(AUTH_KEYS.USERS) || "[]");
    } catch (_error) {
      users = [];
    }
    return users;
  }

  function saveUsers() {
    localStorage.setItem(AUTH_KEYS.USERS, JSON.stringify(users));
  }

  function saveSession(session) {
    currentSession = session;
    localStorage.setItem(AUTH_KEYS.SESSION, JSON.stringify(session));
  }

  function loadSession() {
    try {
      currentSession = JSON.parse(localStorage.getItem(AUTH_KEYS.SESSION) || "null");
    } catch (_error) {
      currentSession = null;
    }
    return currentSession;
  }

  function getRole(email) {
    return APP_CONFIG.adminEmails.includes(normalizeEmail(email)) ? "admin" : "standard";
  }

  function getSessionTimeout(role) {
    return role === "admin" ? SESSION_TIMEOUTS.admin : SESSION_TIMEOUTS.standard;
  }

  function isSessionExpired(session) {
    if (!session?.lastActivityAt) return true;
    return Date.now() - new Date(session.lastActivityAt).getTime() > getSessionTimeout(session.role);
  }

  function showAuthFeedback(message, isError = true) {
    const feedback = byId("authFeedback");
    if (!feedback) return;
    feedback.classList.remove("hidden");
    feedback.textContent = message;
    feedback.style.background = isError ? "rgba(245,158,11,0.18)" : "rgba(0,168,107,0.16)";
    feedback.style.color = isError ? "#92400E" : "#166534";
  }

  function clearAuthFeedback() {
    const feedback = byId("authFeedback");
    if (!feedback) return;
    feedback.classList.add("hidden");
    feedback.textContent = "";
  }

  function toggleAppVisibility(showApp) {
    [document.querySelector("header"), document.querySelector("main"), document.querySelector("footer")].filter(Boolean).forEach((element) => {
      element.classList.toggle("hidden", !showApp);
    });
    byId("authScreen")?.classList.toggle("hidden", showApp);
  }

  function updateSessionBar() {
    const bar = byId("sessionBar");
    if (!bar || !currentUser) return;
    bar.classList.remove("hidden");
    byId("sessionUserName").textContent = currentUser.name || currentUser.email;
    byId("sessionUserMeta").textContent = `${currentUser.email} · ${currentUser.role === "admin" ? "Administrador" : "Usuario"}`;
  }

  function hideSessionBar() {
    byId("sessionBar")?.classList.add("hidden");
  }

  async function hashPassword(password) {
    if (window.crypto?.subtle) {
      const data = new TextEncoder().encode(password);
      const digest = await window.crypto.subtle.digest("SHA-256", data);
      return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
    }
    return btoa(password);
  }

  function validatePassword(password) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,12}$/.test(password);
  }

  function createUser(payload) {
    const user = {
      id: crypto.randomUUID(),
      email: normalizeEmail(payload.email),
      name: payload.name || normalizeEmail(payload.email).split("@")[0],
      role: payload.role || getRole(payload.email),
      provider: payload.provider || "manual",
      passwordHash: payload.passwordHash || null,
      demographics: payload.demographics || null,
      demographicsStatus: payload.demographicsStatus || "pending",
      googleSub: payload.googleSub || null,
      createdAt: new Date().toISOString(),
      lastLoginAt: null
    };
    users.push(user);
    saveUsers();
    return user;
  }

  function findUserByEmail(email) {
    return users.find((user) => normalizeEmail(user.email) === normalizeEmail(email)) || null;
  }

  function updateUser(updated) {
    users = users.map((user) => user.id === updated.id ? updated : user);
    saveUsers();
  }

  function decodeJwt(token) {
    const payload = token.split(".")[1];
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(decodeURIComponent(atob(normalized).split("").map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`).join("")));
  }

  function setAuthTab(tab) {
    document.querySelectorAll(".auth-tab").forEach((button) => button.classList.toggle("active", button.dataset.authTab === tab));
    byId("loginForm")?.classList.toggle("hidden", tab !== "login");
    byId("registerForm")?.classList.toggle("hidden", tab !== "register");
    clearAuthFeedback();
  }

  function touchSession(force = false) {
    if (!currentSession) return;
    if (!force && Date.now() - lastActivityTouch < 15000) return;
    lastActivityTouch = Date.now();
    currentSession.lastActivityAt = new Date().toISOString();
    saveSession(currentSession);
  }

  function startSessionWatch() {
    if (sessionTimer) clearInterval(sessionTimer);
    sessionTimer = window.setInterval(() => {
      if (currentSession && isSessionExpired(currentSession)) {
        logout("La sesion expiro por inactividad.", true);
      }
    }, 30000);
  }

  function loginUser(user, firstAccess = false) {
    currentUser = { ...user, lastLoginAt: new Date().toISOString() };
    updateUser(currentUser);
    saveSession({
      userId: currentUser.id,
      role: currentUser.role,
      email: currentUser.email,
      provider: currentUser.provider,
      lastActivityAt: new Date().toISOString(),
      startedAt: new Date().toISOString()
    });
    toggleAppVisibility(true);
    updateSessionBar();
    clearAuthFeedback();
    startSessionWatch();
    touchSession(true);
    if (firstAccess && currentUser.demographicsStatus === "pending") {
      openDemographics();
    }
  }

  function logout(message = "Sesion cerrada correctamente.", showError = false) {
    currentUser = null;
    currentSession = null;
    localStorage.removeItem(AUTH_KEYS.SESSION);
    toggleAppVisibility(false);
    hideSessionBar();
    closeDemographics();
    showAuthFeedback(message, showError);
    promptGoogleLogin();
  }

  function promptGoogleLogin() {
    if (byId("authScreen")?.classList.contains("hidden")) return;
    if (!googleReady || !window.google?.accounts?.id) return;
    window.google.accounts.id.prompt();
  }

  function renderGoogleButton() {
    const slot = byId("googleLoginContainer");
    const message = byId("googleLoginMessage");
    if (!slot) return;
    if (!APP_CONFIG.googleClientId || !window.google?.accounts?.id) {
      slot.innerHTML = '<button type="button" class="btn btn-outline auth-submit" disabled>Iniciar sesion con Google</button>';
      if (message) {
        message.textContent = isDevelopmentAuthContext()
          ? (APP_CONFIG.googleClientId ? "Google Identity Services aun no esta disponible." : "Configura window.APP_CONFIG.googleClientId para habilitar el acceso con Google.")
          : "";
      }
      return;
    }
    window.google.accounts.id.initialize({
      client_id: APP_CONFIG.googleClientId,
      callback: handleGoogleCredential,
      auto_select: true,
      cancel_on_tap_outside: true
    });
    slot.innerHTML = "";
    window.google.accounts.id.renderButton(slot, {
      theme: "outline",
      size: "large",
      width: getGoogleButtonWidth(),
      text: "signin_with",
      shape: "pill"
    });
    googleReady = true;
    if (message) message.textContent = "";
    promptGoogleLogin();
  }

  function handleGoogleCredential(response) {
    try {
      const profile = decodeJwt(response.credential);
      let user = findUserByEmail(profile.email);
      const firstAccess = !user;
      if (!user) {
        user = createUser({
          email: profile.email,
          name: profile.name || profile.email,
          provider: "google",
          role: getRole(profile.email),
          googleSub: profile.sub
        });
      } else {
        user.name = profile.name || user.name;
        user.provider = "google";
        user.role = getRole(profile.email);
        user.googleSub = profile.sub;
        updateUser(user);
      }
      localStorage.setItem(AUTH_KEYS.PROVIDER, "google");
      loginUser(user, firstAccess);
      notify(`Sesion iniciada como ${user.email}`, "success");
    } catch (_error) {
      showAuthFeedback("No fue posible iniciar sesion con Google.");
    }
  }

  function ensureAuthFieldVisible(target) {
    if (window.innerWidth > 768) return;
    const field = target?.closest?.(".form-group") || target;
    if (!field || typeof field.scrollIntoView !== "function") return;
    window.setTimeout(() => {
      field.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
    }, 180);
  }

  function openDemographics() {
    if (!currentUser) return;
    const info = currentUser.demographics || {};
    byId("demoEdad").value = info.edad || "";
    byId("demoGenero").value = info.genero || "";
    byId("demoSalario").value = info.salario || "";
    byId("demoOcupacion").value = info.ocupacion || "";
    byId("demoEscolaridad").value = info.escolaridad || "";
    byId("demographicsModal").style.display = "flex";
  }

  function closeDemographics() {
    const modal = byId("demographicsModal");
    if (modal) modal.style.display = "none";
  }

  window.cerrarDemografia = closeDemographics;

  function bindAuthUI() {
    document.querySelectorAll(".auth-tab").forEach((button) => button.addEventListener("click", () => setAuthTab(button.dataset.authTab)));
    document.querySelectorAll("#authScreen input").forEach((input) => {
      input.addEventListener("focus", () => ensureAuthFieldVisible(input));
    });
    byId("loginForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = normalizeEmail(byId("loginEmail").value);
      const password = byId("loginPassword").value;
      const user = findUserByEmail(email);
      if (!user || user.provider !== "manual") {
        showAuthFeedback("No existe una cuenta manual con ese correo.");
        return;
      }
      if (user.passwordHash !== await hashPassword(password)) {
        showAuthFeedback("La contrasena no coincide.");
        return;
      }
      localStorage.setItem(AUTH_KEYS.PROVIDER, "manual");
      loginUser(user, false);
      notify(`Bienvenido de nuevo ${user.name}`, "success");
    });
    byId("registerForm")?.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = normalizeEmail(byId("registerEmail").value);
      const password = byId("registerPassword").value;
      const confirmPassword = byId("registerPasswordConfirm").value;
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showAuthFeedback("Ingresa un correo electronico valido.");
        return;
      }
      if (!validatePassword(password)) {
        showAuthFeedback("La contrasena debe tener entre 8 y 12 caracteres, con mayuscula, minuscula, numero y caracter especial.");
        return;
      }
      if (password !== confirmPassword) {
        showAuthFeedback("La confirmacion de contrasena no coincide.");
        return;
      }
      if (findUserByEmail(email)) {
        showAuthFeedback("Ya existe un usuario con ese correo.");
        return;
      }
      const user = createUser({ email, provider: "manual", role: getRole(email), passwordHash: await hashPassword(password) });
      localStorage.setItem(AUTH_KEYS.PROVIDER, "manual");
      loginUser(user, true);
      notify(`Cuenta creada para ${user.email}`, "success");
    });
    byId("btnLogout")?.addEventListener("click", () => logout("Sesion cerrada correctamente.", false));
    byId("btnDemographics")?.addEventListener("click", openDemographics);
    byId("btnSkipDemographics")?.addEventListener("click", () => {
      if (currentUser) {
        currentUser.demographicsStatus = "skipped";
        updateUser(currentUser);
      }
      closeDemographics();
    });
    byId("demographicsForm")?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (!currentUser) return;
      currentUser.demographics = {
        edad: byId("demoEdad").value,
        genero: byId("demoGenero").value,
        salario: byId("demoSalario").value,
        ocupacion: byId("demoOcupacion").value,
        escolaridad: byId("demoEscolaridad").value
      };
      currentUser.demographicsStatus = "completed";
      updateUser(currentUser);
      closeDemographics();
      notify("Datos demograficos guardados para fines estadisticos.", "success");
    });
  }

  function restoreSession() {
    loadUsers();
    const session = loadSession();
    if (!session) {
      toggleAppVisibility(false);
      promptGoogleLogin();
      return;
    }
    if (isSessionExpired(session)) {
      logout("La sesion expiro por inactividad.", true);
      return;
    }
    const user = users.find((item) => item.id === session.userId);
    if (!user) {
      logout("No fue posible recuperar la sesion.", true);
      return;
    }
    currentUser = user;
    currentSession = session;
    toggleAppVisibility(true);
    updateSessionBar();
    startSessionWatch();
  }

  function bootAuthLayer() {
    bindAuthUI();
    renderGoogleButton();
    window.addEventListener("resize", () => {
      if (!byId("authScreen")?.classList.contains("hidden")) {
        renderGoogleButton();
      }
    });
    if (APP_CONFIG.googleClientId && !window.google?.accounts?.id) {
      let retries = 0;
      const waitForGoogle = window.setInterval(() => {
        if (window.google?.accounts?.id) {
          renderGoogleButton();
          window.clearInterval(waitForGoogle);
          return;
        }
        retries += 1;
        if (retries >= 20) {
          window.clearInterval(waitForGoogle);
        }
      }, 500);
    }
    restoreSession();
    ["click", "keydown", "mousemove", "touchstart", "scroll"].forEach((eventName) => {
      document.addEventListener(eventName, () => touchSession(false), { passive: true });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootAuthLayer);
  } else {
    bootAuthLayer();
  }
})();
