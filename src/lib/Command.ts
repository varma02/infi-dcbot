import type { CommandInteraction, SlashCommandBuilder } from "discord.js";
import type { LanguagePack } from "./LanguagePack";
import type { RedisClientType } from "redis";

export type Command = {
	data: SlashCommandBuilder,
	execute: (interaction:CommandInteraction, lang:LanguagePack, db: RedisClientType<any, any, any>) => Promise<void>,
}