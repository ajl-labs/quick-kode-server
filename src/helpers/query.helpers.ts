export const getPagination = (page: number = 1, limit: number = 25) => {
  const offset = (page - 1) * limit;
  return { limit, offset };
};
