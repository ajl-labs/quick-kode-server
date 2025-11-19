import dayjs from "dayjs";

export const formatDate = (date: Date | string, formatStr = "YYYY-MM-DD") => {
  return dayjs(date).format(formatStr);
};

export const parseDate = (dateStr: string, formatStr = "YYYY-MM-DD") => {
  return dayjs(dateStr, formatStr).toDate();
};

export const isValidDate = (date: Date | string) => {
  return dayjs(date).isValid();
};

export const startOfTheMonth = (date: Date | string) => {
  return dayjs(date).startOf("month").toDate();
};

export const endOfTheMonth = (date: Date | string) => {
  return dayjs(date).endOf("month").toDate();
};

export const subtractDays = (date: Date | string, days: number) => {
  return dayjs(date).subtract(days, "day").toDate();
};

export const addDays = (date: Date | string, days: number) => {
  return dayjs(date).add(days, "day").toDate();
};
