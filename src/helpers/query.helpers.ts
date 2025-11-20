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
