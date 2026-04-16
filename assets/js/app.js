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

      // Valor UVR simulado (en la vida real se obtendría de una API)
      let uvrActual = 385.62;
      let monedaSeleccionada = 'COP'; // COP o UVR

      // Utilidades
      const fmtCOP = (v) => new Intl.NumberFormat('es-CO', { 
        style: 'currency', 
        currency: 'COP', 
        minimumFractionDigits: 0,
        maximumFractionDigits: 0 
      }).format(v || 0).replace(/\s/g, '');
      
      const fmtUVR = (v) => v.toFixed(2) + ' UVR';
      
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

      // Estado global
      let entidadesListado = [];
      let obligaciones = [];
      let obligacionesCerradas = [];
      let logrosDesbloqueados = [];
      let ordenMetodo = 'snowball';
      let graficoInstance = null;

      /* ========= FUNCIONES PARA VIVIENDA Y UVR ========= */
      window.toggleMonedaVivienda = function() {
        const tipo = byId('tipoCredito').value;
        const container = byId('monedaViviendaContainer');
        
        if (tipo === 'vivienda') {
          container.style.display = 'block';
          // Por defecto seleccionar COP
          seleccionarMoneda('COP');
        } else {
          container.style.display = 'none';
          monedaSeleccionada = 'COP';
        }
      };

      window.seleccionarMoneda = function(moneda) {
        monedaSeleccionada = moneda;
        
        const copOption = byId('monedaCopOption');
        const uvrOption = byId('monedaUvrOption');
        const uvrInfo = byId('uvrInfo');
        const abonoLabel = byId('abonoBaseLabel');
        
        if (moneda === 'COP') {
          copOption.classList.add('selected');
          uvrOption.classList.remove('selected');
          uvrInfo.style.display = 'none';
          if (abonoLabel) abonoLabel.textContent = 'Abono base (COP)';
        } else {
          copOption.classList.remove('selected');
          uvrOption.classList.add('selected');
          uvrInfo.style.display = 'flex';
          if (abonoLabel) abonoLabel.textContent = 'Abono base (UVR)';
        }
      };

      // Función para convertir UVR a COP (simplificada)
      function uvrToCop(uvr) {
        return uvr * uvrActual;
      }

      function copToUvr(cop) {
        return cop / uvrActual;
      }

      // Actualizar valor UVR cada mes (simulado)
      function actualizarUVR() {
        // Simular variación mensual de la UVR (entre -0.5% y +1.5%)
        const variacion = (Math.random() * 2 - 0.5) / 100;
        uvrActual = uvrActual * (1 + variacion);
        byId('uvrValorActual').textContent = fmtCOP(Math.round(uvrActual));
      }

      // Llamar cada 30 días (simulado)
      setInterval(actualizarUVR, 30 * 24 * 60 * 60 * 1000);

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
        actualizarUVR(); // Valor inicial
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
            .map(o => ({
              ...o,
              cantidadCuotasOriginal: o.cantidadCuotasOriginal ?? o.cantidadCuotas,
              cuotaInicial: o.cuotaInicial || o.numeroCuota,
              historicoAbonos: o.historicoAbonos || [],
              moneda: o.moneda || 'COP' // Por defecto COP
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

      /* ========= MOTOR FINANCIERO CORREGIDO ========= */
      function eaToEm(eaDec) {
        return Math.pow(1 + eaDec, 1/12) - 1;
      }

      function simularIntereses(saldoInicial, em, valorCuota, maxMeses = 600, moneda = 'COP') {
        let saldo = saldoInicial;
        let interesesAcum = 0;
        let meses = 0;

        for (let i = 0; i < maxMeses; i++) {
          if (saldo <= 0) break;
          
          // Si es UVR, actualizar valor cada mes (simulado)
          if (moneda === 'UVR' && i > 0) {
            actualizarUVR();
          }
          
          const interesPeriodo = saldo * em;
          // Si el saldo es menor que la cuota, la cuota se ajusta al saldo
          const pagoCuota = Math.min(valorCuota, saldo + interesPeriodo);
          const amortizacion = Math.max(0, pagoCuota - interesPeriodo);
          if (amortizacion <= 0 && saldo > 0) break;
          saldo -= amortizacion;
          interesesAcum += interesPeriodo;
          meses++;
        }
        return { interesesAcum, meses, saldoFinal: Math.max(0, saldo) };
      }

      function calcularPagoPeriodoYAbono(ob, montoAbono, modoRecalculo) {
        const ea = parsePctToDec(ob.interesEA);
        const em = eaToEm(ea);

        const cuotasRestantes = Math.max(0, ob.cantidadCuotas - ob.numeroCuota + 1);
        
        // Si es UVR, convertir montos a UVR para cálculos internos
        let saldoActual = ob.saldoActual;
        let valorCuota = ob.valorCuota;
        let montoAbonoUVR = montoAbono;
        
        if (ob.moneda === 'UVR') {
          // Los montos ya están en UVR, no convertir
        }
        
        // Interés del período actual
        const interesPeriodo = saldoActual * em;
        // Pago de cuota normal (sin abono extra)
        const pagoCuotaNormal = Math.min(valorCuota, saldoActual + interesPeriodo);
        const amortizacionCuota = Math.max(0, pagoCuotaNormal - interesPeriodo);
        const saldoTrasCuota = Math.max(0, saldoActual - amortizacionCuota);
        
        // Aplicar abono extra después de la cuota (puede ser 0)
        const saldoTrasAbono = Math.max(0, saldoTrasCuota - montoAbonoUVR);

        // Simular escenarios con ajuste automático de cuota cuando saldo es menor
        const base = simularIntereses(saldoTrasCuota, em, valorCuota, 600, ob.moneda);
        const conAbono = simularIntereses(saldoTrasAbono, em, valorCuota, 600, ob.moneda);

        const ahorroIntereses = Math.max(0, base.interesesAcum - conAbono.interesesAcum);
        const mesesAhorrados = Math.max(0, cuotasRestantes - conAbono.meses);

        let nuevoPlazo = conAbono.meses;
        let nuevaCuota = valorCuota;

        if (modoRecalculo === 'mantener_plazo') {
          nuevoPlazo = Math.max(1, cuotasRestantes - 1);
          if (saldoTrasAbono > 0 && nuevoPlazo > 0) {
            // Si el saldo es menor que la cuota original, la nueva cuota será el saldo
            if (saldoTrasAbono < valorCuota) {
              nuevaCuota = saldoTrasAbono;
            } else {
              nuevaCuota = Math.round((saldoTrasAbono * em) / (1 - Math.pow(1 + em, -nuevoPlazo)));
            }
          }
        } else {
          // En modo mantener cuota, si el saldo es menor que la cuota, la cuota se ajusta al saldo
          if (saldoTrasAbono < valorCuota && saldoTrasAbono > 0) {
            nuevaCuota = saldoTrasAbono;
          }
        }

        return {
          interesPeriodo,
          amortizacionCuota,
          saldoTrasAbono,
          ahorroIntereses,
          mesesAhorrados,
          nuevaCuota,
          nuevoPlazo,
          cuotaActualizada: ob.numeroCuota + 1
        };
      }

      /* ========= MÉTRICAS ========= */
      function calcularMetricasGlobales() {
        const activas = obligaciones.filter(ob => ob.saldoActual > 0);
        const saldoTotalCOP = activas.reduce((sum, ob) => {
          if (ob.moneda === 'UVR') {
            return sum + uvrToCop(ob.saldoActual);
          }
          return sum + ob.saldoActual;
        }, 0);
        
        const interesesActivas = obligaciones.reduce((sum, ob) => 
          sum + (ob.historicoAbonos?.reduce((s, a) => {
            if (ob.moneda === 'UVR') {
              return s + uvrToCop(a.ahorroIntereses || 0);
            }
            return s + (a.ahorroIntereses || 0);
          }, 0) || 0), 0);
        const interesesCerradas = obligacionesCerradas.reduce((sum, c) => sum + (c.interesesDejadosDePagar || 0), 0);
        
        const capitalActivas = obligaciones.reduce((sum, ob) => 
          sum + (ob.historicoAbonos?.reduce((s, a) => {
            if (ob.moneda === 'UVR') {
              return s + uvrToCop(a.monto || 0);
            }
            return s + (a.monto || 0);
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

      /* ========= LIBERTAD FINANCIERA CORREGIDA ========= */
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

        // Convertir todo a COP para proyección
        const saldoTotalCOP = activas.reduce((sum, ob) => {
          if (ob.moneda === 'UVR') {
            return sum + uvrToCop(ob.saldoActual);
          }
          return sum + ob.saldoActual;
        }, 0);
        
        const pagoMensualCOP = activas.reduce((sum, ob) => {
          if (ob.moneda === 'UVR') {
            return sum + uvrToCop(ob.valorCuota);
          }
          return sum + ob.valorCuota;
        }, 0);
        
        const abonosRecientes = [];
        activas.forEach(ob => {
          if (ob.historicoAbonos && ob.historicoAbonos.length > 0) {
            ob.historicoAbonos.slice(-3).forEach(a => {
              if (ob.moneda === 'UVR') {
                abonosRecientes.push(uvrToCop(a.monto || 0));
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

        // Tasa promedio ponderada por saldo (ya está en % EA)
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
            if (ob.moneda === 'UVR') {
              return sum + uvrToCop(ob.valorCredito || 0);
            }
            return sum + (ob.valorCredito || 0);
          }, 0);
          puntos.push({ fecha: new Date(obligaciones[0].creadoAt || Date.now()), saldo: saldoInicial });

          obligaciones.forEach(ob => {
            if (ob.historicoAbonos) {
              ob.historicoAbonos.forEach(a => {
                if (a.fecha) {
                  let saldo = a.saldoPosterior || 0;
                  if (ob.moneda === 'UVR') {
                    saldo = uvrToCop(saldo);
                  }
                  puntos.push({ fecha: new Date(a.fecha), saldo });
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
              labels: puntos.map(p => p.fecha.toLocaleDateString()),
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
          nuevos.forEach(l => notificar(`🏆 Logro: ${LOGROS_CONFIG.find(x => x.id === l).nombre}`, 'success'));
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

      /* ========= APLICAR ABONO CORREGIDO - SOPORTA UVR ========= */
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
        
        // Ajustar cuota si es necesario
        if (r.saldoTrasAbono < ob.valorCuota && r.saldoTrasAbono > 0) {
          ob.valorCuota = r.saldoTrasAbono;
        } else if (modoRecalculo === 'mantener_plazo') {
          ob.valorCuota = r.nuevaCuota;
          ob.cantidadCuotas = ob.numeroCuota - 1 + r.nuevoPlazo;
        }

        // Registrar en histórico solo si hay abono
        if (montoAbono > 0) {
          if (!ob.historicoAbonos) ob.historicoAbonos = [];
          ob.historicoAbonos.push({
            fecha: new Date().toLocaleDateString('es-CO'),
            monto: montoAbono,
            ahorroIntereses: r.ahorroIntereses,
            amortizacionCuota: r.amortizacionCuota,
            interesPeriodo: r.interesPeriodo,
            saldoPosterior: r.saldoTrasAbono,
            modoRecalculo,
            nuevaCuota: r.nuevaCuota,
            nuevoPlazo: r.nuevoPlazo,
            mesesAhorrados: r.mesesAhorrados
          });
        }

        // Actualizar UI
        const nuevoSaldoEl = byId('nuevoSaldo_' + id);
        const nuevaCuotaEl = byId('nuevaCuota_' + id);
        const nuevoPlazoEl = byId('nuevoPlazo_' + id);
        const ahorroEl = byId('ahorro_' + id);
        const mesesEl = byId('meses_' + id);
        const cuotaActualEl = document.querySelector(`[data-id="${id}"] .cuota-actual`);

        if (nuevoSaldoEl) nuevoSaldoEl.value = fmtMonto(r.saldoTrasAbono, ob.moneda);
        if (nuevaCuotaEl) nuevaCuotaEl.value = fmtMonto(ob.valorCuota, ob.moneda);
        if (nuevoPlazoEl) nuevoPlazoEl.value = r.nuevoPlazo;
        if (ahorroEl) ahorroEl.value = fmtMonto(r.ahorroIntereses, ob.moneda);
        if (mesesEl) mesesEl.textContent = r.mesesAhorrados;
        if (cuotaActualEl) cuotaActualEl.textContent = `${ob.numeroCuota}/${ob.cantidadCuotas}`;

        // Efecto visual
        const card = document.querySelector(`[data-id="${id}"]`);
        if (card) {
          card.classList.add('highlight-pulse');
          setTimeout(() => card.classList.remove('highlight-pulse'), 1000);
        }

        guardarDatos();
        actualizarDashboard();
        renderizarGrafico();
        verificarLogros();
        
        if (montoAbono > 0) {
          notificar(`✅ Ahorraste ${fmtMonto(r.ahorroIntereses, ob.moneda)} en intereses`, 'success');
          if (r.ahorroIntereses > 50000) lanzarConfeti(50);
        } else {
          notificar(`✅ Cuota ${ob.numeroCuota-1} pagada. Nueva cuota: ${ob.numeroCuota}`, 'info');
        }
      };

      /* ========= CERRAR OBLIGACIÓN CORREGIDO ========= */
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
        const cuotasPagadas = ob.numeroCuota - ob.cuotaInicial;
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

      /* ========= RENDERIZADO OBLIGACIONES CORREGIDO ========= */
      function renderObligaciones() {
        if (ordenMetodo === 'snowball') {
          obligaciones.sort((a, b) => {
            // Convertir a COP para comparar
            const saldoA = a.moneda === 'UVR' ? uvrToCop(a.saldoActual) : a.saldoActual;
            const saldoB = b.moneda === 'UVR' ? uvrToCop(b.saldoActual) : b.saldoActual;
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
          const plazoRestante = ob.cantidadCuotas - ob.numeroCuota + 1;
          const interesesAcum = ob.historicoAbonos?.reduce((s, a) => s + (a.ahorroIntereses || 0), 0) || 0;
          const cuotasAhorradas = ob.historicoAbonos?.reduce((s, a) => s + (a.mesesAhorrados || 0), 0) || 0;
          
          const monedaBadge = ob.moneda === 'UVR' 
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
                <button class="btn btn-sm btn-outline" onclick="cerrarObligacion('${ob.id}')">
                  <i class="fas fa-check-circle"></i> Cerrar
                </button>
              </div>
            </div>

            <div class="grid grid-4" style="margin:16px 0;">
              <div><b>Saldo</b><br>${fmtMonto(ob.saldoActual, ob.moneda)}</div>
              <div><b>Cuota</b><br>${fmtMonto(ob.valorCuota, ob.moneda)}</div>
              <div><b>Interés</b><br>${ob.interesEA}%</div>
              <div><b>Cuota</b><br><span class="cuota-actual">${ob.numeroCuota}/${ob.cantidadCuotas}</span></div>
            </div>

            <div class="grid grid-3">
              <input type="number" id="abono_${ob.id}" class="form-control" placeholder="Abono extra (0 para pago normal)" value="0" min="0" step="${ob.moneda === 'UVR' ? '0.01' : '10000'}">
              <select id="modo_${ob.id}" class="form-control">
                <option value="mantener_cuota">Mantener cuota (menos plazo)</option>
                <option value="mantener_plazo">Mantener plazo (cuota menor)</option>
              </select>
              <button class="btn btn-secondary" onclick="aplicarAbono('${ob.id}')">
                <i class="fas fa-check"></i> Pagar cuota
              </button>
            </div>

            <div class="grid grid-4" style="margin-top:16px; background:var(--color-bg); padding:12px; border-radius:var(--radius-md);">
              <div><b>Nuevo saldo:</b> <input type="text" readonly class="form-control" id="nuevoSaldo_${ob.id}" value="${fmtMonto(ob.saldoActual, ob.moneda)}"></div>
              <div><b>Nueva cuota:</b> <input type="text" readonly class="form-control" id="nuevaCuota_${ob.id}" value="${fmtMonto(ob.valorCuota, ob.moneda)}"></div>
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

      /* ========= RENDERIZADO HISTÓRICO CORREGIDO ========= */
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
          if (c.moneda === 'UVR') {
            return sum + uvrToCop(c.interesesDejadosDePagar || 0);
          }
          return sum + (c.interesesDejadosDePagar || 0);
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
          const interesesEnCOP = c.moneda === 'UVR' ? uvrToCop(c.interesesDejadosDePagar || 0) : (c.interesesDejadosDePagar || 0);
          const valorOriginalEnCOP = c.moneda === 'UVR' ? uvrToCop(valorCreditoOriginal) : valorCreditoOriginal;
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
                <div><span style="color:var(--color-muted);">Crédito original:</span><br><strong>${fmtMonto(c.valorCreditoOriginal || 0, c.moneda || 'COP')}</strong></div>
                <div><span style="color:var(--color-muted);">Total abonado:</span><br><strong>${fmtMonto(c.totalAbonos || 0, c.moneda || 'COP')}</strong></div>
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

      /* ========= COMPARADOR DE OFERTAS CORREGIDO ========= */
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
            ? Math.round(obligaciones[0].valorCredito * ((obligaciones[0].interesEA - o.tasa) / 100) / 12)
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

      /* ========= SIMULADOR CORREGIDO - SOPORTA UVR ========= */
      window.abrirSimulador = function() {
        const modal = byId('modalSimulador');
        const select = byId('simulacionObligacion');
        
        if (obligaciones.length === 0) {
          notificar('Primero debes crear una obligación', 'warning');
          return;
        }
        
        select.innerHTML = obligaciones.map(ob => {
          const monedaIcon = ob.moneda === 'UVR' ? ' (UVR)' : '';
          return `<option value="${ob.id}" data-moneda="${ob.moneda}">${ob.entidad} - ${fmtMonto(ob.saldoActual, ob.moneda)}${monedaIcon}</option>`;
        }).join('');
        
        // Actualizar label según moneda seleccionada
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
        byId('simBaseAbono').textContent = fmtMonto(base, ob.moneda);
        byId('simBasePlazo').textContent = rBase.nuevoPlazo;
        byId('simBaseAhorro').textContent = fmtMonto(rBase.ahorroIntereses, ob.moneda);

        const r25 = calcularPagoPeriodoYAbono(ob, base * 1.25, 'mantener_cuota');
        byId('sim25Abono').textContent = fmtMonto(base * 1.25, ob.moneda);
        byId('sim25Plazo').textContent = r25.nuevoPlazo;
        byId('sim25Ahorro').textContent = fmtMonto(r25.ahorroIntereses, ob.moneda);

        const r50 = calcularPagoPeriodoYAbono(ob, base * 1.5, 'mantener_cuota');
        byId('sim50Abono').textContent = fmtMonto(base * 1.5, ob.moneda);
        byId('sim50Plazo').textContent = r50.nuevoPlazo;
        byId('sim50Ahorro').textContent = fmtMonto(r50.ahorroIntereses, ob.moneda);

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
        
        byId('simCustomAbono').textContent = fmtMonto(abonoCustom, ob.moneda);
        byId('simCustomPlazo').textContent = r.nuevoPlazo;
        byId('simCustomAhorro').textContent = fmtMonto(r.ahorroIntereses, ob.moneda);
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

      /* ========= EXPORTAR A EXCEL CORREGIDO ========= */
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

      function renderizarTodo() {
        renderObligaciones();
        renderCerradas();
        actualizarDashboard();
        renderizarGrafico();
        renderizarLogros();
        actualizarOfertas();
      }

      /* ========= EVENT LISTENERS ========= */
      function inicializarEventListeners() {
        byId('formObligacion').addEventListener('submit', (e) => {
          e.preventDefault();
          
          const nuevaObligacion = {
            id: crypto.randomUUID(),
            entidad: byId('entidadSelect').value,
            tipoCredito: byId('tipoCredito').value,
            moneda: byId('tipoCredito').value === 'vivienda' ? monedaSeleccionada : 'COP',
            fechaProximoVencimiento: byId('fechaVencimiento').value || hoyISO(),
            valorCredito: Number(byId('valorCredito').value),
            valorCuota: Number(byId('valorCuota').value),
            interesEA: Number(byId('interesEA').value),
            numeroCuota: Number(byId('numeroCuota').value),
            cantidadCuotas: Number(byId('cantidadCuotas').value),
            cantidadCuotasOriginal: Number(byId('cantidadCuotas').value),
            cuotaInicial: Number(byId('numeroCuota').value),
            penalidadPrepagoPct: Number(byId('penalidadPrepago').value || 0),
            saldoActual: Number(byId('valorCredito').value),
            historicoAbonos: [],
            creadoAt: new Date().toISOString()
          };

          // Validaciones
          const errors = [];
          if (!nuevaObligacion.entidad) errors.push('Entidad requerida');
          if (!nuevaObligacion.tipoCredito) errors.push('Tipo de crédito requerido');
          if (nuevaObligacion.valorCredito <= 0) errors.push('Valor del crédito debe ser > 0');
          if (nuevaObligacion.valorCuota <= 0) errors.push('Valor cuota debe ser > 0');
          if (nuevaObligacion.interesEA < 0 || nuevaObligacion.interesEA > 60) errors.push('Interés entre 0% y 60%');
          if (nuevaObligacion.numeroCuota < 1) errors.push('Número de cuota debe ser ≥ 1');
          if (nuevaObligacion.cantidadCuotas < nuevaObligacion.numeroCuota) {
            errors.push('Cantidad cuotas debe ser ≥ número actual');
          }

          if (errors.length > 0) {
            alert('❌ Errores:\n- ' + errors.join('\n- '));
            return;
          }

          obligaciones.push(nuevaObligacion);
          guardarDatos();
          renderizarTodo();
          e.target.reset();
          notificar(`✅ Obligación creada correctamente en ${nuevaObligacion.moneda}`, 'success');
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
