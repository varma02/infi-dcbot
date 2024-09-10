import { 
	ActionRowBuilder, 
	ButtonBuilder, 
	ButtonStyle, 
	ComponentType, 
	ModalBuilder, 
	PermissionFlagsBits, 
	SlashCommandBuilder, 
	TextInputBuilder, 
	TextInputStyle, 
	type MessageActionRowComponentBuilder 
} from "discord.js";
import type { Command } from "../lib/Command";

function makeModal(prev: string): ModalBuilder {
	const modal = new ModalBuilder()
		.setCustomId("welcomemsg-modal")
		.setTitle("Set welcome message");

	const textInput = new TextInputBuilder()
		.setCustomId("welcomemsg-text")
		.setLabel("You have 5 minutes")
		.setStyle(TextInputStyle.Paragraph)
		.setValue(prev);

	const firstRow = new ActionRowBuilder<TextInputBuilder>()
		.addComponents(textInput);

	modal.addComponents(firstRow);
	return modal;
}

export default {
	data: new SlashCommandBuilder()
		.setName("üdvözlő_üzenet")
		.setDescription("Üdvözlő üzenet beállítása új tagoknak")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
		
	async execute(interaction, db) {
		let welcometext = await db.get(`welcome-message:${interaction.guildId}`) || "❌ Nincs beállítva üdvözlő üzenet";
		const message = await interaction.reply({
			content:`**ÜDVÖZLŐ ÜZENET ELŐNÉZETE:**\n\n${welcometext}\n`,
			components: [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
				new ButtonBuilder()
					.setStyle(ButtonStyle.Primary)
					.setCustomId("welcome-msg-save")
					.setEmoji("💾")
					.setLabel("Mentés"),
				new ButtonBuilder()
					.setStyle(ButtonStyle.Secondary)
					.setCustomId("welcome-msg-edit")
					.setEmoji("✏️")
					.setLabel("Szerkesztés"),
					new ButtonBuilder()
					.setStyle(ButtonStyle.Secondary)
					.setCustomId("welcome-msg-remove")
					.setEmoji("🗑")
					.setLabel("Törlés"),
				)],
			ephemeral: true,
		});

		const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 1200000 });
		
		collector.on('collect', async (i) => {
			if (i.user.id !== interaction.user.id) return;
			switch (i.customId) {
				case "welcome-msg-save":
					await db.set(`welcome-message:${interaction.guildId}`, welcometext);
					i.reply({ content: "💾 Üzenet mentve", ephemeral: true });
				break;
				case "welcome-msg-edit":
					i.showModal(makeModal(welcometext));
					const modal_response = await i.awaitModalSubmit({ time: 1200000, filter: (mi) => mi.customId == "welcomemsg-modal" && mi.user.id == interaction.user.id });
					welcometext = modal_response.fields.getTextInputValue("welcomemsg-text").trim();
					message.edit({ content: `**ÜDVÖZLŐ ÜZENET ELŐNÉZETE:**\n\n${welcometext}\n` });
					modal_response.reply({ content: "🔄 Üzenet frissítve", ephemeral: true });
				break;
				case "welcome-msg-remove":
					welcometext = "";
					message.delete();
					await db.set(`welcome-message:${interaction.guildId}`, "");
					i.reply({ content: "🗑 Üdvözlő üzenet törölve", ephemeral: true });
				break;
			}
		});

		collector.once('end', () => {
			message.edit({ components: [] });
		})
	}
} as Command;