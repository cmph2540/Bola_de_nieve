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

      let uvrActual = UVR_CONFIG.DEFAULT_VALUE;
      let uvrFuenteActual = 'manual';
      let monedaSeleccionada = 'COP'; // COP o UVR
      let graficoProyeccionUVR = null;
      let obligacionEditandoId = null;

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
      const parseStoredDate = (value) => {
        if (!value) return null;
        if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
        if (typeof value === "string" && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
          const [day, month, year] = value.split("/").map(Number);
          const parsed = new Date(year, month - 1, day);
          return Number.isNaN(parsed.getTime()) ? null : parsed;
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

        if (!esCreditoUVR(ob)) {
          return {
            ...abono,
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
          obligacionesCerradas = JSON.parse(localStorage.getItem(STORAGE_KEYS.OBLIGACIONES_CERRADAS) || '[]');
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

      /* ========= FUNCIÓN CORREGIDA PARA CÁLCULO DE ABONO (SOLO ESTO CAMBIÓ) ========= */
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

      /* ========= MÉTRICAS ========= */
      function calcularMetricasGlobales() {
        const activas = obligaciones.filter(ob => ob.saldoActual > 0);
        const saldoTotalCOP = activas.reduce((sum, ob) => {
          return sum + (esCreditoUVR(ob) ? obtenerSaldoActualCOP(ob) : Number(ob.saldoActual || 0));
        }, 0);
        
        const interesesActivas = obligaciones.reduce((sum, ob) => 
          sum + (ob.historicoAbonos?.reduce((s, a) => {
            return s + obtenerAhorroInteresesCOP(ob, a);
          }, 0) || 0), 0);
        const interesesCerradas = obligacionesCerradas.reduce((sum, c) => sum + (c.interesesDejadosDePagar || 0), 0);
        
        const capitalActivas = obligaciones.reduce((sum, ob) => 
          sum + (ob.historicoAbonos?.reduce((s, a) => {
            return s + obtenerMontoAbonoCOP(ob, a);
          }, 0) || 0), 0);
        
        const cuotasTotales = obligacionesCerradas.reduce((sum, c) => sum + (c.cuotasDejadasDePagar || 0), 0) +
          obligaciones.reduce((sum, ob) => sum + (ob.historicoAbonos?.reduce((s, a) => s + (a.mesesAhorrados || 0), 0) || 0), 0);

        return {
          saldoTotal: saldoTotalCOP,
          interesesTotales: interesesActivas + interesesCerradas,
          capitalTotal: capitalActivas,
          cuotasTotales
        };
      }

      function actualizarDashboard() {
        const m = calcularMetricasGlobales();
        byId('totalSaldoPendiente').textContent = fmtCOP(m.saldoTotal);
        byId('totalInteresesAhorrados').textContent = fmtCOP(m.interesesTotales);
        byId('totalCapitalAmortizado').textContent = fmtCOP(m.capitalTotal);
        byId('totalCuotasEvitadas').textContent = m.cuotasTotales;
        actualizarProyeccionLibertad();
      }

      /* ========= LIBERTAD FINANCIERA ========= */
      function calcularFechaLibertad() {
        const activas = obligaciones.filter(ob => ob.saldoActual > 0);
        
        if (activas.length === 0) {
          return { 
            fecha: '--', 
            progreso: 0, 
            esLibre: false,
            mensajeDetalle: '💰 Sin deudas activas'
          };
        }

        const saldoTotalCOP = activas.reduce((sum, ob) => {
          return sum + (esCreditoUVR(ob) ? obtenerSaldoActualCOP(ob) : Number(ob.saldoActual || 0));
        }, 0);
        
        const pagoMensualCOP = activas.reduce((sum, ob) => {
          return sum + (esCreditoUVR(ob) ? roundTo(uvrToCop(ob.valorCuota, obtenerUVRProyectadaObligacion(ob, ob.fechaProximoVencimiento || addMonthsIso(hoyISO(), 1))), 2) : Number(ob.valorCuota || 0));
        }, 0);
        
        const abonosRecientes = [];
        activas.forEach(ob => {
          if (ob.historicoAbonos && ob.historicoAbonos.length > 0) {
            ob.historicoAbonos.slice(-3).forEach(a => {
              if (ob.moneda === 'UVR') {
                abonosRecientes.push(obtenerMontoAbonoCOP(ob, a));
              } else {
                abonosRecientes.push(a.monto || 0);
              }
            });
          }
        });
        const promedioAbono = abonosRecientes.length > 0 
          ? abonosRecientes.reduce((a, b) => a + b, 0) / abonosRecientes.length 
          : 0;
        
        const capacidad = pagoMensualCOP + promedioAbono;
        if (capacidad <= 0) return { fecha: 'Sin datos', progreso: 0, esLibre: false, mensajeDetalle: `💰 ${activas.length} deuda(s)` };

        const tasaPromedio = activas.reduce((sum, ob) => 
          sum + (parsePctToDec(ob.interesEA) * (ob.saldoActual / activas.reduce((s, o) => s + o.saldoActual, 0))), 0);
        const em = eaToEm(tasaPromedio);

        let meses = 0;
        let saldoSim = saldoTotalCOP;
        const maxMeses = 600;
        
        while (saldoSim > 0.01 && meses < maxMeses) {
          const interes = saldoSim * em;
          const pago = Math.min(saldoSim + interes, capacidad);
          const abonoCapital = Math.max(0, pago - interes);
          saldoSim -= abonoCapital;
          meses++;
          if (abonoCapital <= 0) break;
        }

        const progreso = saldoTotalCOP > 0 ? ((saldoTotalCOP - Math.max(0, saldoSim)) / saldoTotalCOP) * 100 : 100;
        const fecha = new Date();
        fecha.setMonth(fecha.getMonth() + meses);
        
        return {
          fecha: fecha.toLocaleDateString('es-CO', { year: 'numeric', month: 'long' }),
          progreso: Math.min(100, Math.max(0, progreso)),
          esLibre: false,
          mensajeDetalle: `💰 ${fmtCOP(saldoTotalCOP)} · ${activas.length} deuda(s)`
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

      /* ========= APLICAR ABONO CORREGIDO ========= */
      window.aplicarAbono = function(id) {
        const ob = obligaciones.find(o => o.id === id);
        if (!ob) return;
        
        const abonoInput = byId('abono_' + id);
        const modoSelect = byId('modo_' + id);
        const montoAbono = Number(abonoInput?.value) || 0;
        const modoRecalculo = modoSelect?.value || 'mantener_cuota';

        const r = calcularPagoPeriodoYAbono(ob, montoAbono, modoRecalculo);

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
        if (montoAbono > 0 || r.montoAbonoCOPReal > 0) {
          if (!ob.historicoAbonos) ob.historicoAbonos = [];
          const registroAbono = {
            fecha: formatDateDisplay(new Date()),
            fechaRegistro: new Date().toISOString(),
            monto: montoAbono,
            montoAbonoCOP: r.montoAbonoCOPReal,
            ahorroIntereses: r.ahorroInteresesCOPReales,
            amortizacionCuota: r.amortizacionCuotaCOP,
            interesPeriodo: r.interesPeriodoCOP,
            saldoPosterior: r.saldoTrasAbonoCOP,
            modoRecalculo,
            nuevaCuota: ob.valorCuota,
            nuevoPlazo: r.nuevoPlazo,
            mesesAhorrados: r.mesesAhorrados,
            cuotaAntes: ob.valorCuota
          };
          
          if (esCreditoUVR(ob)) {
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
        const numeroAbonos = historicoAbonos.length;
        const totalAbonos = historicoAbonos.reduce((s, a) => s + (a.monto || 0), 0);
        const totalInteresesDejados = historicoAbonos.reduce((s, a) => s + (a.ahorroIntereses || 0), 0);
        const capitalAmortizado = historicoAbonos.reduce((s, a) => s + (a.amortizacionCuota || 0), 0);
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
          valorCreditoOriginal: ob.valorCredito,
          saldoFinal: ob.saldoActual,
          interesEA: ob.interesEA,
          numeroAbonos: numeroAbonos,
          totalAbonos: totalAbonos,
          interesesDejadosDePagar: totalInteresesDejados,
          cuotasDejadasDePagar: cuotasDejadasDePagar,
          historicoAbonos: historicoAbonos,
          capitalAmortizado: capitalAmortizado,
          interesPeriodoTotal: interesPeriodoTotal,
          mesesAhorradosTotal: mesesAhorradosTotal,
          creadoAt: ob.creadoAt
        };

        obligacionesCerradas.push(cerrada);
        obligaciones = obligaciones.filter(o => o.id !== id);
        
        guardarDatos();
        renderizarTodo();
        lanzarConfeti(150);
        
        let mensaje = `🎉 ¡Felicidades! Cerraste ${ob.entidad}`;
        if (cuotasDejadasDePagar >= 12) {
          mensaje += ` y evitaste ${cuotasDejadasDePagar} cuotas! 🏆`;
        } else if (totalInteresesDejados > 100000) {
          mensaje += ` con un ahorro de ${fmtMonto(totalInteresesDejados, ob.moneda)}! 💰`;
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
          
          const monedaBadge = esCreditoUVR(ob)
            ? '<span class="badge badge-uvr"><i class="fas fa-chart-line"></i> UVR</span>' 
            : '<span class="badge badge-primary"><i class="fas fa-coins"></i> COP</span>';
          
          return `
          <div class="card" data-id="${ob.id}">
            <div class="flex justify-between">
              <div>
                <h3>${ob.entidad} <span class="badge badge-success">${ob.tipoCredito}</span> ${monedaBadge}</h3>
                <small><i class="far fa-calendar-alt"></i> Vence: ${ob.fechaProximoVencimiento}</small>
              </div>
              <div class="flex gap-2">
                <span class="badge badge-primary"><i class="fas fa-piggy-bank"></i> ${fmtMonto(interesesAcum, ob.moneda)}</span>
                ${esCreditoUVR(ob) ? `<button class="btn btn-sm btn-outline" onclick="abrirProyeccionUVR('${ob.id}')"><i class="fas fa-chart-line"></i> Proyeccion</button>` : ''}
                <button class="btn btn-sm btn-outline" onclick="cerrarObligacion('${ob.id}')">
                  <i class="fas fa-check-circle"></i> Cerrar
                </button>
              </div>
            </div>

            <div class="grid grid-4" style="margin:16px 0;">
              <div><b>Saldo</b><br>${saldoMostrar}</div>
              <div><b>Cuota</b><br>${cuotaMostrar}</div>
              <div><b>Interés EA</b><br>${ob.interesEA}%</div>
              <div><b>Cuota actual</b><br><span class="cuota-actual">${ob.numeroCuota}/${ob.cantidadCuotas}</span></div>
            </div>

            <div class="grid grid-3" style="margin-top:16px;">
              <input type="number" id="abono_${ob.id}" class="form-control" placeholder="Abono extra en COP" value="0" min="0" step="10000">
              <select id="modo_${ob.id}" class="form-control">
                <option value="mantener_cuota">Mantener cuota (menos plazo)</option>
                <option value="mantener_plazo">Mantener plazo (cuota menor)</option>
              </select>
              <button class="btn btn-secondary" onclick="aplicarAbono('${ob.id}')">
                <i class="fas fa-check"></i> Pagar cuota
              </button>
            </div>

            <div class="grid grid-4" style="margin-top:16px; background:var(--color-bg); padding:12px; border-radius:var(--radius-md);">
              <div><b>Nuevo saldo:</b> <input type="text" readonly class="form-control" id="nuevoSaldo_${ob.id}" value="${saldoMostrar}"></div>
              <div><b>Nueva cuota:</b> <input type="text" readonly class="form-control" id="nuevaCuota_${ob.id}" value="${cuotaMostrar}"></div>
              <div><b>Plazo restante:</b> <input type="text" readonly class="form-control" id="nuevoPlazo_${ob.id}" value="${plazoRestante}"></div>
              <div><b>Ahorro:</b> <input type="text" readonly class="form-control" id="ahorro_${ob.id}" value="${fmtMonto(0, ob.moneda)}"></div>
            </div>
            <div class="grid grid-4" style="margin-top:8px; font-size:12px; color:var(--color-muted);">
              <div>Meses ahorrados: <span id="meses_${ob.id}">${cuotasAhorradas}</span></div>
              <div>Total ahorrado: ${fmtMonto(interesesAcum, ob.moneda)}</div>
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
          return sum + Number(c.interesesDejadosDePagar || 0);
        }, 0);
        const totalCuotas = obligacionesCerradas.reduce((sum, c) => sum + (c.cuotasDejadasDePagar || 0), 0);
        const totalAbonos = obligacionesCerradas.reduce((sum, c) => sum + (c.numeroAbonos || 0), 0);

        byId('totalCerradas').textContent = totalCerradas;
        byId('totalInteresesHistoricos').textContent = fmtCOP(totalIntereses);
        byId('totalCuotasHistoricas').textContent = totalCuotas;
        byId('totalAbonosHistoricos').textContent = totalAbonos;

        container.innerHTML = obligacionesCerradas.slice().reverse().map(c => {
          const numeroAbonos = c.numeroAbonos || c.historicoAbonos?.length || 0;
          const valorCreditoOriginal = c.valorCreditoOriginal || 0;
          const interesesEnCOP = Number(c.interesesDejadosDePagar || 0);
          const valorOriginalEnCOP = Number(c.valorCreditoOriginalCOP || valorCreditoOriginal || 0);
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
                <div><span style="color:var(--color-muted);">Total abonado:</span><br><strong>${fmtCOP(c.totalAbonos || 0)}</strong></div>
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
        const select = byId('simulacionObligacion');
        const selectedOption = select.options[select.selectedIndex];
        const moneda = selectedOption?.getAttribute('data-moneda') || 'COP';
        const label = byId('abonoBaseLabel');
        
        if (moneda === 'UVR') {
          label.textContent = 'Abono base (UVR)';
          byId('simulacionAbono').step = '0.01';
          byId('simulacionAbono').placeholder = 'Ej: 50.00';
        } else {
          label.textContent = 'Abono base (COP)';
          byId('simulacionAbono').step = '10000';
          byId('simulacionAbono').placeholder = 'Ej: 50000';
        }
      }

      window.cerrarSimulador = () => byId('modalSimulador').style.display = 'none';

      window.actualizarSimulacion = function() {
        const obId = byId('simulacionObligacion').value;
        const base = Number(byId('simulacionAbono').value) || 0;
        const ob = obligaciones.find(o => o.id === obId);
        if (!ob) return;

        const rBase = calcularPagoPeriodoYAbono(ob, base, 'mantener_cuota');
        const dualBase = esCreditoUVR(ob)
          ? `${fmtCOP(base)} | ${fmtUVR(rBase.montoAbonoUVR)}`
          : fmtCOP(base);
        byId('simBaseAbono').textContent = dualBase;
        byId('simBasePlazo').textContent = rBase.nuevoPlazo;
        byId('simBaseAhorro').textContent = esCreditoUVR(ob)
          ? `${fmtCOP(rBase.ahorroInteresesCOPReales)} | ${fmtUVR(rBase.ahorroIntereses)}`
          : fmtCOP(rBase.ahorroInteresesCOPReales);

        const r25 = calcularPagoPeriodoYAbono(ob, base * 1.25, 'mantener_cuota');
        const dual25 = esCreditoUVR(ob)
          ? `${fmtCOP(base * 1.25)} | ${fmtUVR(r25.montoAbonoUVR)}`
          : fmtCOP(base * 1.25);
        byId('sim25Abono').textContent = dual25;
        byId('sim25Plazo').textContent = r25.nuevoPlazo;
        byId('sim25Ahorro').textContent = esCreditoUVR(ob)
          ? `${fmtCOP(r25.ahorroInteresesCOPReales)} | ${fmtUVR(r25.ahorroIntereses)}`
          : fmtCOP(r25.ahorroInteresesCOPReales);

        const r50 = calcularPagoPeriodoYAbono(ob, base * 1.5, 'mantener_cuota');
        const dual50 = esCreditoUVR(ob)
          ? `${fmtCOP(base * 1.5)} | ${fmtUVR(r50.montoAbonoUVR)}`
          : fmtCOP(base * 1.5);
        byId('sim50Abono').textContent = dual50;
        byId('sim50Plazo').textContent = r50.nuevoPlazo;
        byId('sim50Ahorro').textContent = esCreditoUVR(ob)
          ? `${fmtCOP(r50.ahorroInteresesCOPReales)} | ${fmtUVR(r50.ahorroIntereses)}`
          : fmtCOP(r50.ahorroInteresesCOPReales);

        actualizarSimulacionPersonalizada();
      };

      window.actualizarSimulacionPersonalizada = function() {
        const obId = byId('simulacionObligacion').value;
        const base = Number(byId('simulacionAbono').value) || 0;
        const pct = Number(byId('simulacionPorcentaje').value) / 100;
        const ob = obligaciones.find(o => o.id === obId);
        if (!ob) return;

        const abonoCustom = base * (1 + pct);
        const r = calcularPagoPeriodoYAbono(ob, abonoCustom, 'mantener_cuota');
        
        byId('simulacionPorcentajeValor').textContent = `${Math.round(pct * 100)}%`;
        const porcentajeCustom = byId('porcentajeCustom');
        porcentajeCustom.textContent = `${Math.round(pct * 100)}%`;
        
        if (pct <= 0.25) porcentajeCustom.style.background = 'var(--color-primary)';
        else if (pct <= 0.5) porcentajeCustom.style.background = 'var(--color-warning)';
        else if (pct <= 0.75) porcentajeCustom.style.background = 'var(--color-secondary)';
        else porcentajeCustom.style.background = 'var(--color-accent)';
        
        byId('simCustomAbono').textContent = esCreditoUVR(ob)
          ? `${fmtCOP(abonoCustom)} | ${fmtUVR(r.montoAbonoUVR)}`
          : fmtCOP(abonoCustom);
        byId('simCustomPlazo').textContent = r.nuevoPlazo;
        byId('simCustomAhorro').textContent = esCreditoUVR(ob)
          ? `${fmtCOP(r.ahorroInteresesCOPReales)} | ${fmtUVR(r.ahorroIntereses)}`
          : fmtCOP(r.ahorroInteresesCOPReales);
      };

      window.aplicarSimulacion = function() {
        const obId = byId('simulacionObligacion').value;
        const base = Number(byId('simulacionAbono').value) || 0;
        const pct = Number(byId('simulacionPorcentaje').value) / 100;
        const input = byId(`abono_${obId}`);
        const ob = obligaciones.find(o => o.id === obId);
        
        if (input) {
          const valor = Math.round(base * (1 + pct) * (ob?.moneda === 'UVR' ? 100 : 1)) / (ob?.moneda === 'UVR' ? 100 : 1);
          input.value = valor;
          input.classList.add('highlight-pulse');
          setTimeout(() => input.classList.remove('highlight-pulse'), 1000);
          
          const card = document.querySelector(`[data-id="${obId}"]`);
          if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }
        cerrarSimulador();
        notificar(`✅ Abono de ${fmtMonto(Math.round(base * (1 + pct) * (ob?.moneda === 'UVR' ? 100 : 1)) / (ob?.moneda === 'UVR' ? 100 : 1), ob?.moneda || 'COP')} listo para aplicar`, 'success');
      };

      /* ========= EXPORTAR A EXCEL ========= */
      function exportarAExcel() {
        if (obligacionesCerradas.length === 0) {
          notificar('No hay historial para exportar', 'warning');
          return;
        }

        try {
          const datosExcel = obligacionesCerradas.map(c => ({
            'Entidad': c.entidad || 'N/A',
            'Tipo de crédito': c.tipoCredito || 'N/A',
            'Moneda': c.moneda || 'COP',
            'Fecha de cierre': c.fechaCierre || 'N/A',
            'Valor crédito original': c.moneda === 'UVR' ? c.valorCreditoOriginal?.toFixed(2) + ' UVR' : fmtCOP(c.valorCreditoOriginal || 0),
            'Saldo final': c.moneda === 'UVR' ? c.saldoFinal?.toFixed(2) + ' UVR' : fmtCOP(c.saldoFinal || 0),
            'Tasa EA %': c.interesEA || 0,
            'Número de abonos': c.numeroAbonos || 0,
            'Total abonado': c.moneda === 'UVR' ? c.totalAbonos?.toFixed(2) + ' UVR' : fmtCOP(c.totalAbonos || 0),
            'Intereses ahorrados': c.moneda === 'UVR' ? c.interesesDejadosDePagar?.toFixed(2) + ' UVR' : fmtCOP(c.interesesDejadosDePagar || 0),
            'Cuotas evitadas': c.cuotasDejadasDePagar || 0,
            'Meses ahorrados total': c.mesesAhorradosTotal || 0
          }));

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
        const uvrManual = byId('uvrManual');
        if (uvrManual) uvrManual.value = roundTo(uvrActual, 4).toFixed(4);
        if (byId('inflacionEsperadaEA')) byId('inflacionEsperadaEA').value = UVR_CONFIG.DEFAULT_INFLATION_EA;
        obligacionEditandoId = null;
        monedaSeleccionada = 'COP';
        actualizarVisibilidadCamposUVR();
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
          const nuevaObligacion = construirObligacionDesdeFormulario();

          const errors = validarObligacionFormulario(nuevaObligacion);
          if (!nuevaObligacion.entidad) errors.push('Entidad requerida');
          if (!nuevaObligacion.tipoCredito) errors.push('Tipo de crédito requerido');
          if (nuevaObligacion.valorCredito <= 0 && nuevaObligacion.moneda !== 'UVR') errors.push('Valor del crédito debe ser > 0');
          if (nuevaObligacion.valorCuota <= 0 && nuevaObligacion.moneda !== 'UVR') errors.push('Valor cuota debe ser > 0');
          if (nuevaObligacion.interesEA < 0 || nuevaObligacion.interesEA > 60) errors.push('Interés entre 0% y 60%');
          if (nuevaObligacion.numeroCuota < 1) errors.push('Numero de cuota debe ser ≥ 1');
          if (nuevaObligacion.cantidadCuotas < nuevaObligacion.numeroCuota) {
            errors.push('Cantidad cuotas debe ser ≥ número actual');
          }

          const erroresUnicos = [...new Set(errors)];
          if (erroresUnicos.length > 0) {
            alert('Errores:\n- ' + erroresUnicos.join('\n- '));
            return;
          }

          obligaciones.push(nuevaObligacion);
          guardarDatos();
          renderizarTodo();
          limpiarFormularioObligacion();
          
          notificar(`✅ Obligacion creada correctamente en ${nuevaObligacion.moneda}`, 'success');
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
      }

      window.notificar = notificar;
      window.filtrarPorMetrica = (tipo) => {
        notificar(`Filtro por ${tipo} disponible próximamente`, 'info');
      };
      window.cambiarVistaGrafico = (vista) => {
        renderizarGrafico();
        notificar(`Vista ${vista}`, 'info');
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
      if (message) message.textContent = APP_CONFIG.googleClientId ? "Google Identity Services aun no esta disponible." : "Configura window.APP_CONFIG.googleClientId para habilitar el acceso con Google.";
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
      width: 320,
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