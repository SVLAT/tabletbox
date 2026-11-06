const DAY=86400000;
export function dayNumber(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('Выберите дату начала');const n=Date.parse(date+'T00:00:00Z');if(!Number.isFinite(n)||new Date(n).toISOString().slice(0,10)!==date)throw Error('Проверьте дату начала');return n/DAY;}
export const addDays=(date,days)=>new Date((dayNumber(date)+days)*DAY).toISOString().slice(0,10);
export const daysBetween=(start,end)=>dayNumber(end)-dayNumber(start);
export function courseEnd(start,days){if(!Number.isInteger(days)||days<1||days>3660)throw Error('Длительность курса: от 1 до 3660 дней');return addDays(start,days);}
export function courseSummary(d,today){const total=daysBetween(d.start,d.end),day=Math.max(0,Math.min(total,daysBetween(d.start,today)+1));return {total,day,last:addDays(d.end,-1)};}
