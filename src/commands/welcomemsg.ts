import { ActionRowBuilder, EmbedBuilder, ModalBuilder, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from "discord.js";
import type { Command } from "../lib/Command";

export default {
	data: new SlashCommandBuilder()
		.setName("welcomemsg")
		.setDescription("Set the welcome message sent to new members"),
	async execute(interaction, lang, db) {
		const modal = new ModalBuilder()
			.setCustomId("welcomemsg-modal")
			.setTitle("Set welcome message");

		const textInput = new TextInputBuilder()
			.setCustomId("welcomemsg-text")
			.setLabel("You have 5 minutes")
			.setStyle(TextInputStyle.Paragraph)
			.setValue(`${await db.get("welcome-message")}`);

		const firstRow = new ActionRowBuilder<TextInputBuilder>()
			.addComponents(textInput);

		modal.addComponents(firstRow);
		await interaction.showModal(modal);

		const response = await interaction.awaitModalSubmit({
			time: 300000, filter: (i) => i.isModalSubmit() && i.customId == "welcomemsg-modal" && i.user.id == interaction.user.id});

		try {
			await db.set("welcome-message", response.fields.getTextInputValue("welcomemsg-text"));
			await response.reply({embeds:[new EmbedBuilder().setDescription(lang.welcomeMessageUpdateSuccess).setColor("Blue")]});
		} catch (err) {
			await response.reply({embeds:[new EmbedBuilder().setDescription(lang.welcomeMessageUpdateFail).setColor("Red")]});
			console.warn("Failed to update welcome message", err);
		}
		
	}
} as Command;