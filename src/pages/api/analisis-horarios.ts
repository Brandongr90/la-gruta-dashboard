import type { APIRoute } from "astro";

export const GET: APIRoute = async () => {
  try {
    const supabaseUrl = import.meta.env.SUPABASE_URL;
    const supabaseKey = import.meta.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Configuración de Supabase no encontrada",
        }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    // Obtener la fecha actual en zona horaria de México
    const mexicoDate = new Date().toLocaleString("en-US", {
      timeZone: "America/Mexico_City",
    });
    const today = new Date(mexicoDate);

    // Calcular inicio y fin del mes actual
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    // Formatear fechas para la consulta
    const startDate = startOfMonth.toISOString();
    const endDate = endOfMonth.toISOString();

    // Consultar ventas del mes
    const queryResponse = await fetch(
      `${supabaseUrl}/rest/v1/ventas?select=*&fecha_hora=gte.${startDate}&fecha_hora=lte.${endDate}&order=fecha_hora.asc`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    if (!queryResponse.ok) {
      throw new Error("Error al consultar ventas para análisis de horarios");
    }

    const ventas = await queryResponse.json();

    // Agrupar por hora del día (0-23)
    const ventasPorHora: any = {};
    for (let h = 0; h < 24; h++) {
      ventasPorHora[h] = {
        total: 0,
        ventas: 0,
        entradas: 0,
      };
    }

    // Procesar cada venta
    ventas.forEach((venta: any) => {
      // Convertir a zona horaria de México
      const fechaMexico = new Date(venta.fecha_hora).toLocaleString("en-US", {
        timeZone: "America/Mexico_City",
      });
      const fecha = new Date(fechaMexico);
      const hora = fecha.getHours();

      ventasPorHora[hora].total += parseFloat(venta.monto_total) || 0;
      ventasPorHora[hora].ventas += 1;
      ventasPorHora[hora].entradas += parseInt(venta.entradas_totales) || 0;
    });

    // Convertir a array ordenado
    const horariosArray = [];
    for (let h = 0; h < 24; h++) {
      horariosArray.push({
        hora: h,
        horaFormato: `${h.toString().padStart(2, '0')}:00`,
        total: ventasPorHora[h].total,
        ventas: ventasPorHora[h].ventas,
        entradas: ventasPorHora[h].entradas,
      });
    }

    // Encontrar hora pico (mayor número de ventas)
    let horaPicoVentas = 0;
    let maxVentas = 0;
    let horaPicoIngresos = 0;
    let maxIngresos = 0;

    horariosArray.forEach((h) => {
      if (h.ventas > maxVentas) {
        maxVentas = h.ventas;
        horaPicoVentas = h.hora;
      }
      if (h.total > maxIngresos) {
        maxIngresos = h.total;
        horaPicoIngresos = h.hora;
      }
    });

    // Calcular totales
    const totalVentas = ventas.length;
    const totalIngresos = ventas.reduce((sum: number, v: any) => sum + (parseFloat(v.monto_total) || 0), 0);
    const totalEntradas = ventas.reduce((sum: number, v: any) => sum + (parseInt(v.entradas_totales) || 0), 0);

    // Calcular ticket promedio
    const ticketPromedio = totalVentas > 0 ? totalIngresos / totalVentas : 0;

    // Calcular promedio de entradas por venta
    const entradasPromedio = totalVentas > 0 ? totalEntradas / totalVentas : 0;

    // Identificar horarios de operación (horas con al menos 1 venta)
    const horasActivas = horariosArray.filter(h => h.ventas > 0);
    const horaApertura = horasActivas.length > 0 ? horasActivas[0].hora : 0;
    const horaCierre = horasActivas.length > 0 ? horasActivas[horasActivas.length - 1].hora : 23;

    // Calcular distribución de ventas por periodo del día
    const distribucionPorPeriodo = {
      mañana: { total: 0, ventas: 0 }, // 6-12
      tarde: { total: 0, ventas: 0 },   // 12-18
      noche: { total: 0, ventas: 0 },   // 18-24
      madrugada: { total: 0, ventas: 0 }, // 0-6
    };

    horariosArray.forEach((h) => {
      if (h.hora >= 6 && h.hora < 12) {
        distribucionPorPeriodo.mañana.total += h.total;
        distribucionPorPeriodo.mañana.ventas += h.ventas;
      } else if (h.hora >= 12 && h.hora < 18) {
        distribucionPorPeriodo.tarde.total += h.total;
        distribucionPorPeriodo.tarde.ventas += h.ventas;
      } else if (h.hora >= 18 && h.hora < 24) {
        distribucionPorPeriodo.noche.total += h.total;
        distribucionPorPeriodo.noche.ventas += h.ventas;
      } else {
        distribucionPorPeriodo.madrugada.total += h.total;
        distribucionPorPeriodo.madrugada.ventas += h.ventas;
      }
    });

    // Obtener nombre del mes
    const nombreMes = today.toLocaleString('es-MX', { month: 'long' });
    const año = today.getFullYear();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ventasPorHora: horariosArray,
          horaPicoVentas: horaPicoVentas,
          horaPicoIngresos: horaPicoIngresos,
          ticketPromedio: ticketPromedio,
          entradasPromedio: entradasPromedio,
          horaApertura: horaApertura,
          horaCierre: horaCierre,
          distribucionPorPeriodo: distribucionPorPeriodo,
          totalVentas: totalVentas,
          totalIngresos: totalIngresos,
          totalEntradas: totalEntradas,
          mes: nombreMes,
          año: año,
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error en API analisis-horarios:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Error desconocido",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
