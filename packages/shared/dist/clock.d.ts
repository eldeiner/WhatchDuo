/**
 * Sincronización de reloj estilo NTP simplificado.
 *
 * t0 = reloj local al enviar
 * t1 = reloj del servidor al recibir/responder
 * t2 = reloj local al recibir la respuesta
 *
 * offset = t1 - (t0 + t2) / 2
 * rtt    = t2 - t0
 *
 * Se toman varias muestras y se usa la mediana de las de menor RTT para
 * reducir el impacto de picos de latencia.
 */
export interface ClockSample {
    /** ms que el reloj local va por detrás del servidor (serverTime - localTime). */
    offset: number;
    /** ida y vuelta en ms */
    rtt: number;
    /** epoch ms local en el momento del cálculo */
    at: number;
}
export declare function sampleFromPong(clientSentAt: number, serverTime: number, receivedAt: number): ClockSample;
export declare function median(values: number[]): number;
/**
 * Selecciona las `keep` muestras con menor RTT y devuelve la mediana de sus
 * offsets. Filtrar por RTT bajo evita que una petición lenta contamine el reloj.
 */
export declare function estimateOffset(samples: ClockSample[], keep?: number): {
    offset: number;
    rtt: number;
    used: number;
};
export declare function keepRecentSamples(samples: ClockSample[], limit: number): ClockSample[];
export declare function serverNowFrom(localNow: number, offset: number): number;
export declare function localTimeFrom(serverTime: number, offset: number): number;
/** Formatea segundos como m:ss (o h:mm:ss). */
export declare function formatTime(totalSeconds: number): string;
