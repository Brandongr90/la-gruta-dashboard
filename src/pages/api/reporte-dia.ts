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

    // Obtener la fecha actual en zona horaria de México (America/Mexico_City)
    const mexicoDate = new Date().toLocaleString("en-US", {
      timeZone: "America/Mexico_City",
    });
    const today = new Date(mexicoDate).toISOString().split("T")[0];

    // Calcular inicio y fin del día en hora de México
    const startOfDay = `${today}T00:00:00-06:00`; // CST/MDT timezone
    const endOfDay = `${today}T23:59:59-06:00`;

    // Consultar Supabase usando la API REST
    const response = await fetch(
      `${supabaseUrl}/rest/v1/rpc/obtener_reporte_dia_actual`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({ fecha: today }),
      }
    );

    if (!response.ok) {
      // Si la función RPC no existe, hacer la consulta manualmente
      const queryResponse = await fetch(
        `${supabaseUrl}/rest/v1/ventas?select=*&fecha_hora=gte.${startOfDay}&fecha_hora=lte.${endOfDay}`,
        {
          headers: {
            apikey: supabaseKey,
            Authorization: `Bearer ${supabaseKey}`,
          },
        }
      );

      if (!queryResponse.ok) {
        throw new Error("Error al consultar ventas");
      }

      const ventas = await queryResponse.json();

      // Calcular totales manualmente
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

      return new Response(
        JSON.stringify({
          success: true,
          data: totales,
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const data = await response.json();

    return new Response(
      JSON.stringify({
        success: true,
        data: data,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error en API reporte-dia:", error);
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
