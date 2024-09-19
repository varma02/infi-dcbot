import { 
	ActionRowBuilder, 
	ButtonBuilder, 
	ButtonStyle, 
	ChannelType, 
	CommandInteractionOptionResolver,
	InteractionCollector, 
	ModalBuilder, 
	parseEmoji, 
	PermissionFlagsBits,
	RoleSelectMenuBuilder, 
	SlashCommandBuilder, 
	SlashCommandChannelOption, 
	SlashCommandStringOption, 
	SlashCommandSubcommandBuilder, 
	TextInputBuilder, 
	TextInputStyle, 
	type GuildTextBasedChannel, 
	type MessageActionRowComponentBuilder, 
	type ModalActionRowComponentBuilder,
} from "discord.js";
import type { Command } from "../lib/Command";
import lang from "../lang";

function buildrows(roles: {[key: string]: {label:string, emoji:string}}) {
	if (Object.keys(roles).length == 0) return [];
	const rows = [];
	let i = 0;
	let row = new ActionRowBuilder<MessageActionRowComponentBuilder>()
	for (const [k, v] of Object.entries(roles)) {
		row.addComponents(
			new ButtonBuilder()
			.setCustomId(`roleselect-${k}`)
			.setStyle(ButtonStyle.Secondary)
			.setLabel(v.label)
			.setEmoji(v.emoji)
		);
		i++;
		if (i >= 5) {
			rows.push(row);
			row = new ActionRowBuilder<MessageActionRowComponentBuilder>();
			i = 0;
		}
	}
	return rows;
}

export default {
	data: new SlashCommandBuilder()
		.setDMPermission(false)
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
			.setName("törlés")
			.setDescription("Meglévő rang választó üzenet törlése")
			.addStringOption(
				new SlashCommandStringOption()
				.setName("id")
				.setDescription("Az rang választó azonosítója")
				.setRequired(true)
			)
		),
		
	async execute(interaction, db) {
		const options = interaction.options as CommandInteractionOptionResolver;
		console.debug(`Executing command rang_választó with subcommand ${options.getSubcommand()}`);
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
			const roles: {[key: string]: {label:string, emoji:string}} = {};
			
			const msg = await modal_response.reply({
				ephemeral: true,
				content: lang.roleselect_new_preview.replace("{1}", text),
				components: [
					new ActionRowBuilder<MessageActionRowComponentBuilder>()
					.addComponents(
						new RoleSelectMenuBuilder()
							.setCustomId("roleselect-new-menu")
							.setPlaceholder(lang.roleselect_new_select_placeholder)
							.setMaxValues(1)
							.setMinValues(0),
					),
					new ActionRowBuilder<MessageActionRowComponentBuilder>()
					.addComponents(
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

			const collector = new InteractionCollector(interaction.client, { time: 1200000,
				filter: (i) => i.user.id == interaction.user.id && i.customId.startsWith("roleselect-new-"),
			});
			collector.on("collect", async (i) => {
				if (i.customId == "roleselect-new-save") {
					const start_time = Date.now();
					const msg = await channel.send({ content: `${text}\n*||ID:${start_time}||*`, components: buildrows(roles) });
					await db.hSet(`roleselect:${i.guildId}:${start_time}`, {channel: channel.id, message: msg.id, roles: JSON.stringify(Object.keys(roles))});
					await i.reply({ content: lang.roleselect_new_saved, ephemeral: true });
					collector.stop();
				} else if (i.customId == "roleselect-new-discard") {
					await i.reply({ content: lang.roleselect_new_discarded, ephemeral: true });
					collector.stop();
				} else if (i.customId == "roleselect-new-menu") {
					if (!i.isRoleSelectMenu()) return;
					if (roles[i.values[0]]) {
						delete roles[i.values[0]];
						i.reply({ content: "❌ Rang törölve", ephemeral: true });
					} else {
						if (Object.keys(roles).length >= 15) {
							await i.reply({ content: "❌ Maximum 15 rang választható", ephemeral: true });
							return;
						}
						await i.showModal(
							new ModalBuilder()
							.setCustomId("roleselect-new-role-modal")
							.setTitle(lang.roleselect_new_role_title)
							.addComponents(
								new ActionRowBuilder<ModalActionRowComponentBuilder>()
								.addComponents(
									new TextInputBuilder()
									.setCustomId("roleselect-new-role-btn-label")
									.setLabel(lang.roleselect_new_role_btn_label)
									.setStyle(TextInputStyle.Short)
									.setRequired(true)
								),
								new ActionRowBuilder<ModalActionRowComponentBuilder>()
								.addComponents(
									new TextInputBuilder()
									.setCustomId("roleselect-new-role-btn-emoji")
									.setLabel(lang.roleselect_new_role_btn_emoji)
									.setStyle(TextInputStyle.Short)
									.setRequired(true)
								)
							)
						);
						const modal_response = await i.awaitModalSubmit({
							time: 1200000, filter: (i) => i.isModalSubmit() && i.customId == "roleselect-new-role-modal" && i.user.id == interaction.user.id});
						const label = modal_response.fields.getTextInputValue("roleselect-new-role-btn-label");
						const emoji = modal_response.fields.getTextInputValue("roleselect-new-role-btn-emoji");
						if (!parseEmoji(emoji)) {
							await modal_response.reply({ content: "❌ Hibás emoji", ephemeral: true });
							return;
						}
						roles[i.values[0]] = {label, emoji: emoji};
						modal_response.reply({ content: "✅ Rang hozzáadva", ephemeral: true });
					}
					
					msg.edit({
						components: [
							...buildrows(roles),
							new ActionRowBuilder<MessageActionRowComponentBuilder>()
							.addComponents(
								new RoleSelectMenuBuilder()
									.setCustomId("roleselect-new-menu")
									.setPlaceholder(lang.roleselect_new_select_placeholder)
									.setMaxValues(1)
									.setMinValues(0),
							),
							new ActionRowBuilder<MessageActionRowComponentBuilder>()
							.addComponents(
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
						]
					});
				}
			});
			collector.once("end", () => {
				msg.edit({ components: [] }).catch(() => {});
			});
		} else if (options.getSubcommand() === "törlés") {
			const id = options.getString("id", true);
			const data = await db.hGetAll(`roleselect:${interaction.guildId}:${id}`);
			if (!data || !data.channel) {
				await interaction.reply({ content: lang.roleselect_not_found, ephemeral: true });
				return;
			}
			const channel = await interaction.client.channels.fetch(data.channel) as GuildTextBasedChannel;
			await channel.messages.delete(data.message);
			await db.del(`roleselect:${interaction.guildId}:${id}`);
			await interaction.reply({ content: lang.roleselect_removed, ephemeral: true });
		}
	}
} as Command;