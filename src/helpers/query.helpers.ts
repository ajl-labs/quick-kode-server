export const encodeCursor = (row: { created_at: Date; id: string }) => {
  const json = JSON.stringify({
    created_at: row.created_at,
    id: row.id,
  });
  return Buffer.from(json).toString("base64");
};

export const decodeCursor = (cursor: string) => {
  const json = Buffer.from(cursor, "base64").toString("utf8");
  return JSON.parse(json);
};

export const buildWhereClause = (filters: Record<string, any>) => {
  const keys = Object.keys(filters);
  const clauses: string[] = [];
  const params: any[] = [];

  keys.forEach((key) => {
    const value = filters[key];

    // skip null or undefined
    if (value === undefined || value === null) return;

    // array -> IN / ANY
    if (Array.isArray(value)) {
      params.push(value);
      clauses.push(`${key} = ANY($${params.length})`);
      return;
    }

    // string with % -> LIKE
    if (typeof value === "string" && value.includes("%")) {
      params.push(value);
      clauses.push(`${key} LIKE $${params.length}`);
      return;
    }

    // default: equals
    params.push(value);
    clauses.push(`${key} = $${params.length}`);
  });

  if (clauses.length === 0) return { where: "", params: [] };

  return {
    where: "WHERE " + clauses.join(" AND "),
    params,
  };
};
