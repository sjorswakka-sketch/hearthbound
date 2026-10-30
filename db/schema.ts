import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const gameRooms = sqliteTable("game_rooms", {
  code: text("code").primaryKey(),
  revision: integer("revision").notNull().default(0),
  stateJson: text("state_json").notNull(),
  updatedAt: text("updated_at").notNull(),
});
