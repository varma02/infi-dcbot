import type { CommandInteraction, SlashCommandBuilder } from "discord.js";
import type { RedisClientType } from "redis";

export type Command = {
	data: SlashCommandBuilder,
	execute: (interaction:CommandInteraction, db: RedisClientType<any, any, any>) => Promise<void>,
}