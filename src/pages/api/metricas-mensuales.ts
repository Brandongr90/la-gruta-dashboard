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
      throw new Error("Error al consultar ventas mensuales");
    }

    const ventas = await queryResponse.json();

    // Calcular totales del mes
    const totales = ventas.reduce(
      (acc: any, venta: any) => {
        acc.total_entradas += parseInt(venta.entradas_totales) || 0;
        acc.total_cortesias += parseInt(venta.cortesias) || 0;

        const monto = parseFloat(venta.monto_total) || 0;

        if (venta.forma_pago === "efectivo") {
          acc.total_efectivo += monto;
        } else if (venta.forma_pago === "transferencia") {
          acc.total_transferencia += monto;
        } else if (venta.forma_pago === "tarjeta") {
          if (venta.terminal === "terminal1") {
            acc.total_terminal1 += monto;
          } else if (venta.terminal === "terminal2") {
            acc.total_terminal2 += monto;
          }
        }

        acc.total_ventas += 1;
        return acc;
      },
      {
        total_entradas: 0,
        total_cortesias: 0,
        total_efectivo: 0,
        total_transferencia: 0,
        total_terminal1: 0,
        total_terminal2: 0,
        total_ventas: 0,
      }
    );

    // Agrupar por día del mes
    const ventasPorDia: any = {};

    ventas.forEach((venta: any) => {
      const fecha = new Date(venta.fecha_hora);
      const dia = fecha.getDate();

      if (!ventasPorDia[dia]) {
        ventasPorDia[dia] = {
          total: 0,
          ventas: 0,
          entradas: 0,
        };
      }

      ventasPorDia[dia].total += parseFloat(venta.monto_total) || 0;
      ventasPorDia[dia].ventas += 1;
      ventasPorDia[dia].entradas += parseInt(venta.entradas_totales) || 0;
    });

    // Crear array ordenado de días con datos
    const diasDelMes: any[] = [];
    const numeroDias = endOfMonth.getDate();

    for (let dia = 1; dia <= numeroDias; dia++) {
      diasDelMes.push({
        dia: dia,
        total: ventasPorDia[dia]?.total || 0,
        ventas: ventasPorDia[dia]?.ventas || 0,
        entradas: ventasPorDia[dia]?.entradas || 0,
      });
    }

    // Agrupar por semanas del mes
    const ventasPorSemana: any[] = [];
    let semanaActual = 1;
    let inicioSemana = 1;

    for (let dia = 1; dia <= numeroDias; dia++) {
      const fechaDia = new Date(today.getFullYear(), today.getMonth(), dia);
      const diaSemana = fechaDia.getDay();

      // Si es domingo (0) o es el último día del mes, cerrar la semana
      if (diaSemana === 0 || dia === numeroDias) {
        const finSemana = dia;
        let totalSemana = 0;
        let ventasSemana = 0;
        let entradasSemana = 0;

        // Sumar todos los días de esta semana
        for (let d = inicioSemana; d <= finSemana; d++) {
          totalSemana += ventasPorDia[d]?.total || 0;
          ventasSemana += ventasPorDia[d]?.ventas || 0;
          entradasSemana += ventasPorDia[d]?.entradas || 0;
        }

        ventasPorSemana.push({
          semana: semanaActual,
          rango: `${inicioSemana}-${finSemana}`,
          total: totalSemana,
          ventas: ventasSemana,
          entradas: entradasSemana,
        });

        semanaActual++;
        inicioSemana = dia + 1;
      }
    }

    // Obtener nombre del mes
    const nombreMes = today.toLocaleString('es-MX', { month: 'long' });
    const año = today.getFullYear();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ...totales,
          ventasPorDia: diasDelMes,
          ventasPorSemana: ventasPorSemana,
          mes: nombreMes,
          año: año,
          fechaInicio: startOfMonth.toISOString().split('T')[0],
          fechaFin: endOfMonth.toISOString().split('T')[0],
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error en API metricas-mensuales:", error);
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
