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

    // Calcular inicio de la semana (lunes) y fin de la semana (domingo)
    const dayOfWeek = today.getDay();
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Si es domingo (0), retrocede 6 días

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    endOfWeek.setHours(23, 59, 59, 999);

    // Formatear fechas para la consulta
    const startDate = startOfWeek.toISOString();
    const endDate = endOfWeek.toISOString();

    // Consultar ventas de la semana
    const queryResponse = await fetch(
      `${supabaseUrl}/rest/v1/ventas?select=*&fecha_hora=gte.${startDate}&fecha_hora=lte.${endDate}&order=fecha_hora.desc`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
      }
    );

    if (!queryResponse.ok) {
      throw new Error("Error al consultar ventas semanales");
    }

    const ventas = await queryResponse.json();

    // Calcular totales de la semana
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

    // Agrupar por día de la semana
    const ventasPorDia: any = {};
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

    ventas.forEach((venta: any) => {
      // Convertir a zona horaria de México
      const fechaMexico = new Date(venta.fecha_hora).toLocaleString("en-US", {
        timeZone: "America/Mexico_City",
      });
      const fecha = new Date(fechaMexico);
      const diaNombre = diasSemana[fecha.getDay()];

      if (!ventasPorDia[diaNombre]) {
        ventasPorDia[diaNombre] = {
          total: 0,
          ventas: 0,
        };
      }

      ventasPorDia[diaNombre].total += parseFloat(venta.monto_total) || 0;
      ventasPorDia[diaNombre].ventas += 1;
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          ...totales,
          ventasPorDia,
          fechaInicio: startOfWeek.toISOString().split('T')[0],
          fechaFin: endOfWeek.toISOString().split('T')[0],
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error en API reporte-semanal:", error);
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
