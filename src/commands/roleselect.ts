import { 
	ActionRowBuilder, 
	ButtonBuilder, 
	ButtonStyle, 
	ChannelType, 
	CommandInteractionOptionResolver, 
	ComponentType, 
	ModalBuilder, 
	PermissionFlagsBits, 
	SlashCommandBuilder, 
	SlashCommandChannelOption, 
	SlashCommandSubcommandBuilder, 
	TextInputBuilder, 
	TextInputStyle, 
	type GuildTextBasedChannel, 
	type MessageActionRowComponentBuilder, 
	type ModalActionRowComponentBuilder
} from "discord.js";
import type { Command } from "../lib/Command";
import lang from "../lang";

export default {
	data: new SlashCommandBuilder()
		.setName("rang_választó")
		.setDescription("Rang választó üzenet létrehozása / szerkesztése")
		.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addSubcommand(
			new SlashCommandSubcommandBuilder()
			.setName("új")
			.setDescription("Új rang választó üzenet létrehozása")
			.addChannelOption(
				new SlashCommandChannelOption()
				.setName("szöveges_csatorna")
				.setDescription("A szöveges csatorna 🤯")
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true)
			)
		).addSubcommand(
			new SlashCommandSubcommandBuilder()
			.setName("szerkesztés")
			.setDescription("Meglévő rang választó üzenet szerkesztése")
			.addChannelOption(
				new SlashCommandChannelOption()
				.setName("id")
				.setDescription("Az rang választó azonosítója")
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true)
			)
		),
		
	async execute(interaction, db) {
		const options = interaction.options as CommandInteractionOptionResolver;
		if (options.getSubcommand() === "új") {
			const channel = options.getChannel("szöveges_csatorna") as GuildTextBasedChannel;
			await interaction.showModal(
				new ModalBuilder()
				.setCustomId("roleselect-new-modal")
				.setTitle(lang.roleselect_new_modal_title)
				.addComponents(
					new ActionRowBuilder<ModalActionRowComponentBuilder>()
					.addComponents(
						new TextInputBuilder()
						.setCustomId("roleselect-new-msg")
						.setLabel(lang.roleselect_new_modal_text)
						.setStyle(TextInputStyle.Paragraph)
						.setRequired(true)
					)
				)
			)
		}
	}
} as Command;