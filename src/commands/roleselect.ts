import { 
	ActionRowBuilder, 
	ButtonBuilder, 
	ButtonStyle, 
	ChannelType, 
	CommandInteractionOptionResolver, 
	ComponentType, 
	ModalBuilder, 
	PermissionFlagsBits, 
	Role, 
	RoleSelectMenuBuilder, 
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
			);

			const modal_response = await interaction.awaitModalSubmit({
				time: 1200000, filter: (i) => i.isModalSubmit() && i.customId == "roleselect-new-modal" && i.user.id == interaction.user.id});
			
			const channel = options.getChannel("szöveges_csatorna", true, [ChannelType.GuildText]);
			const text = modal_response.fields.getTextInputValue("roleselect-new-msg");
			const roles: Role[] = [];
			
			const msg = await modal_response.reply({
				ephemeral: true,
				content: lang.roleselect_new_preview.replace("{1}", text),
				components: [
					new ActionRowBuilder<MessageActionRowComponentBuilder>()
					.addComponents(
						new RoleSelectMenuBuilder()
							.setCustomId("roleselect-new-menu")
							.setPlaceholder(lang.roleselect_new_select_placeholder)
							.setMaxValues(1),
						new ButtonBuilder()
							.setCustomId("roleselect-new-save")
							.setLabel(lang.roleselect_new_send_btn)
							.setEmoji("💌")
							.setStyle(ButtonStyle.Primary),
						new ButtonBuilder()
							.setCustomId("roleselect-new-discard")
							.setLabel(lang.roleselect_new_discard_btn)
							.setEmoji("🗑️")
							.setStyle(ButtonStyle.Secondary),
					)
				],
			});

			const collector = msg.createMessageComponentCollector({componentType: ComponentType.Button, time: 1200000});
			collector.on("collect", async (i) => {
				if (i.customId == "roleselect-new-save") {
					await i.reply({ content: lang.roleselect_new_saved, ephemeral: true });
					collector.stop();
				} else if (i.customId == "roleselect-new-discard") {
					await i.reply({ content: lang.roleselect_new_discarded, ephemeral: true });
					collector.stop();
				}
			});
			collector.on("end", async () => {
				await msg.edit({ components: [] });
			});
		}
	}
} as Command;