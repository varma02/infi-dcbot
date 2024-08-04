import { SlashCommandBuilder } from "discord.js";
import type { Command } from "../lib/Command";

export default {
	data: new SlashCommandBuilder()
		.setName("welcomemsg")
		.setDescription("Set the welcome message sent to new members"),
	async execute(interaction) {
		interaction.reply("WIP");
	}
} as Command;