import { zonedTimeToUtc, utcToZonedTime, format } from 'date-fns-tz';

/**
 * Converte uma data do timezone do usuário para UTC
 * @param date Data no timezone do usuário
 * @param timezone Timezone do usuário (ex: 'America/Sao_Paulo')
 * @returns Date em UTC para salvar no banco
 */
export function toUTC(date: Date, timezone: string = 'America/Sao_Paulo'): Date {
  // Se a data já está em UTC mas queremos tratar como se fosse no timezone do usuário
  // Precisamos criar uma string ISO no timezone do usuário e converter para UTC
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = date.getSeconds();
  
  // Criar uma string ISO assumindo que os valores estão no timezone do usuário
  const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  
  // Converter para UTC
  return zonedTimeToUtc(dateStr, timezone);
}

/**
 * Converte uma data de UTC para o timezone do usuário
 * @param utcDate Data em UTC do banco
 * @param timezone Timezone do usuário (ex: 'America/Sao_Paulo')
 * @returns Date no timezone do usuário
 */
export function fromUTC(utcDate: Date, timezone: string = 'America/Sao_Paulo'): Date {
  return utcToZonedTime(utcDate, timezone);
}

/**
 * Obtém a data atual no timezone do usuário
 * @param timezone Timezone do usuário
 * @returns Date representando agora no timezone do usuário
 */
export function nowInTimezone(timezone: string = 'America/Sao_Paulo'): Date {
  const now = new Date();
  return fromUTC(now, timezone);
}

/**
 * Formata uma data UTC para exibição no timezone do usuário
 * @param utcDate Data em UTC
 * @param formatStr Formato desejado (date-fns format)
 * @param timezone Timezone do usuário
 * @returns String formatada
 */
export function formatInTimezone(
  utcDate: Date,
  formatStr: string,
  timezone: string = 'America/Sao_Paulo'
): string {
  const zonedDate = fromUTC(utcDate, timezone);
  return format(zonedDate, formatStr, { timeZone: timezone });
}

