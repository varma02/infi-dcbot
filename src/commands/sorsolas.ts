import { ActionRowBuilder, ButtonBuilder, ChannelType, CommandInteractionOptionResolver, type MessageActionRowComponentBuilder, ModalBuilder, SlashCommandBuilder, SlashCommandChannelOption, SlashCommandSubcommandBuilder, TextInputBuilder, TextInputStyle, type ModalActionRowComponentBuilder, ButtonStyle, ComponentType, SlashCommandIntegerOption, type GuildTextBasedChannel, PermissionFlagsBits, InteractionCollector, parseEmoji } from "discord.js";
import type { Command } from "../lib/Command";
import lang from "../lang";

export default {
	data: new SlashCommandBuilder()
	.setName("sorsolás")
	.setDescription("Sorsolások kezelése, szerkesztése, lezárása")
	.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
	.setDMPermission(false)
	.addSubcommand(
		new SlashCommandSubcommandBuilder()
		.setName("új")
		.setDescription("Új sorsolás készítése")
		.addChannelOption(
			new SlashCommandChannelOption()
			.setName("szöveges_csatorna")
			.setDescription("A szöveges csatorna 🤯")
			.addChannelTypes(ChannelType.GuildText)
			.setRequired(true)
		)
	).addSubcommand(
		new SlashCommandSubcommandBuilder()
		.setName("lezárás")
		.setDescription("Meglévő sorsolás lezárása")
		.addIntegerOption(
			new SlashCommandIntegerOption()
			.setName("sorsolás_id")
			.setDescription("A sorsolás azonosítója")
			.setRequired(true)
		)
	),

	async execute(interaction, db) {
		const options = interaction.options as CommandInteractionOptionResolver;
		switch (options.getSubcommand()) {
			case "új":
				await interaction.showModal(
					new ModalBuilder()
					.setCustomId("sorsolas-new-modal")
					.setTitle(lang.sorsolas_new_modal_title)
					.addComponents(
						new ActionRowBuilder<ModalActionRowComponentBuilder>()
						.addComponents(
							new TextInputBuilder()
							.setCustomId("sorsolas-new-time")
							.setLabel(lang.sorsolas_new_modal_time)
							.setStyle(TextInputStyle.Short)
							.setRequired(true)
						),
						new ActionRowBuilder<ModalActionRowComponentBuilder>()
						.addComponents(
							new TextInputBuilder()
							.setCustomId("sorsolas-new-btnemoji")
							.setLabel(lang.sorsolas_new_modal_emoji)
							.setStyle(TextInputStyle.Short)
							.setRequired(true)
						),
						new ActionRowBuilder<ModalActionRowComponentBuilder>()
						.addComponents(
							new TextInputBuilder()
							.setCustomId("sorsolas-new-btntext")
							.setLabel(lang.sorsolas_new_modal_btn_text)
							.setStyle(TextInputStyle.Short)
							.setRequired(false)
						),
						new ActionRowBuilder<ModalActionRowComponentBuilder>()
						.addComponents(
							new TextInputBuilder()
							.setCustomId("sorsolas-new-message")
							.setLabel(lang.sorsolas_new_modal_text)
							.setStyle(TextInputStyle.Paragraph)
							.setRequired(true)
						)
					)
				);
				
				const modal_response = await interaction.awaitModalSubmit({
				time: 1200000, filter: (i) => i.isModalSubmit() && i.customId == "sorsolas-new-modal" && i.user.id == interaction.user.id});
				
				const channel = options.getChannel("szöveges_csatorna", true, [ChannelType.GuildText]);
				const time = parseFloat(modal_response.fields.getTextInputValue("sorsolas-new-time"));
				const btnemoji = modal_response.fields.getTextInputValue("sorsolas-new-btnemoji");
				const btntext = modal_response.fields.getTextInputValue("sorsolas-new-btntext");
				const text = modal_response.fields.getTextInputValue("sorsolas-new-message");
				
				if (!parseEmoji(btnemoji)) {
					modal_response.reply({ content: lang.invalid_emoji, ephemeral: true });
					return;
				}

				const message = await modal_response.reply({
					ephemeral: true,
					content: lang.sorsolas_new_preview.replace("{1}", text),
					components: [
						new ActionRowBuilder<MessageActionRowComponentBuilder>()
						.addComponents(
							new ButtonBuilder()
							.setCustomId("sorsolas-new-test-btn")
							.setStyle(ButtonStyle.Primary)
							.setEmoji(btnemoji)
							.setLabel(btntext),
						),
						new ActionRowBuilder<MessageActionRowComponentBuilder>()
						.addComponents(
							new ButtonBuilder()
							.setCustomId("sorsolas-new-send")
							.setStyle(ButtonStyle.Primary)
							.setEmoji("📧")
							.setLabel(lang.sorsolas_new_send_btn),
							new ButtonBuilder()
							.setCustomId("sorsolas-new-discard")
							.setStyle(ButtonStyle.Secondary)
							.setEmoji("🗑")
							.setLabel(lang.sorsolas_new_discard_btn),
						),
					],
				});
				
				const collector = new InteractionCollector(interaction.client, {
					componentType: ComponentType.Button, time: 1200000, 
					filter: (i) => i.user.id == interaction.user.id && i.customId.startsWith("sorsolas-new-"),
				});

				collector.on('collect', async (i) => {
					switch (i.customId) {
						case "sorsolas-new-test-btn":
							i.reply({ content: lang.enter_sorsolas, ephemeral: true });
						break;
						case "sorsolas-new-send":
							const msg = await channel.send(lang.sorsolas_new_loading);
							const start_time = Date.now();
							if (!interaction.guildId) {
								interaction.reply(lang.unexpected_error.replace("{1}", "NO_GUILD_ID"));
								msg.delete();
								return;
							}
							await db.hSet(`sorsolasok:${interaction.guildId}:${start_time}`, {'guildId': interaction.guildId!, 'channelId': channel.id, 'messageId': msg.id, 'time': time});
							await db.sAdd("sorsolasok", `${interaction.guildId}:${start_time}:${time}`);
							msg.edit({
								content: text+`\n||*\`ID:${start_time}\`*||`,
								components: [
									new ActionRowBuilder<MessageActionRowComponentBuilder>()
									.addComponents(
										new ButtonBuilder()
										.setCustomId(`sorsolas-register-${start_time}`)
										.setStyle(ButtonStyle.Primary)
										.setEmoji(btnemoji)
										.setLabel(btntext),
									)
								]
							});
							if (i.replied) break;
							i.reply({ content: lang.sorsolas_started, ephemeral: true });
						break;
						case "sorsolas-new-discard":
							if (i.replied) break;
							collector.stop();
							i.reply({ content: lang.sorsolas_discarded, ephemeral: true });
						break;
					}
				});
				collector.once('end', () => {
					message.edit({ components: [] });
				});
			break;
			case "lezárás":
				const sorsolas_id = options.getInteger("sorsolás_id", true);
				const sorsolas = await db.hGetAll(`sorsolasok:${interaction.guildId}:${sorsolas_id}`);
				if (!sorsolas || !sorsolas.messageId) {
					interaction.reply({ content: lang.sorsolas_not_found, ephemeral: true });
					return;
				}
				const winner = await db.sRandMember(`sorsolasok:${interaction.guildId}:${sorsolas_id}:participants`);
				
				const smsg = await (await interaction.guild?.channels.fetch(sorsolas.channelId) as GuildTextBasedChannel)?.messages.fetch(sorsolas.messageId);
				smsg.edit({components: []});
				smsg.reply(lang.sorsolas_winner.replace("{1}", `<@${winner}>`));
				
				await db.sRem("sorsolasok", `${interaction.guildId}:${sorsolas_id}:${sorsolas.time}`);
				await db.del([`sorsolasok:${interaction.guildId}:${sorsolas_id}`, `sorsolasok:${interaction.guildId}:${sorsolas_id}:participants`]);
				
				await interaction.reply({ content: lang.sorsolas_closed.replace("{1}", `<@${winner}>`), ephemeral: true });
			break;
		}
	},
} as Command