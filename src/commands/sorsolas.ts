import { ActionRowBuilder, ButtonBuilder, ChannelType, CommandInteractionOptionResolver, type MessageActionRowComponentBuilder, ModalBuilder, SlashCommandBuilder, SlashCommandChannelOption, SlashCommandSubcommandBuilder, TextInputBuilder, TextInputStyle, type ModalActionRowComponentBuilder, ButtonStyle, ComponentType, SlashCommandIntegerOption, type GuildTextBasedChannel, PermissionFlagsBits } from "discord.js";
import type { Command } from "../lib/Command";

export default {
	data: new SlashCommandBuilder()
	.setName("sorsolás")
	.setDescription("Sorsolások kezelése, szerkesztése, lezárása")
	.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
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
					.setTitle("Új sorsolás")
					.addComponents(
						new ActionRowBuilder<ModalActionRowComponentBuilder>()
						.addComponents(
							new TextInputBuilder()
							.setCustomId("sorsolas-new-time")
							.setLabel("Időtartam (percben)")
							.setStyle(TextInputStyle.Short)
							.setRequired(true)
						),
						new ActionRowBuilder<ModalActionRowComponentBuilder>()
						.addComponents(
							new TextInputBuilder()
							.setCustomId("sorsolas-new-btnemoji")
							.setLabel("Gomb emoji")
							.setStyle(TextInputStyle.Short)
							.setRequired(true)
						),
						new ActionRowBuilder<ModalActionRowComponentBuilder>()
						.addComponents(
							new TextInputBuilder()
							.setCustomId("sorsolas-new-btntext")
							.setLabel("Gomb szöveg")
							.setStyle(TextInputStyle.Short)
							.setRequired(false)
						),
						new ActionRowBuilder<ModalActionRowComponentBuilder>()
						.addComponents(
							new TextInputBuilder()
							.setCustomId("sorsolas-new-message")
							.setLabel("Üzenet")
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
				
				const message = await modal_response.reply({
					ephemeral: true,
					content: `**SORSOLÁS ÜZENET ELŐNÉZET:**\n\n${text}\n`,
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
							.setLabel("Küldés"),
							new ButtonBuilder()
							.setCustomId("sorsolas-new-discard")
							.setStyle(ButtonStyle.Secondary)
							.setEmoji("🗑")
							.setLabel("Elvetés"),
						),
					],
				});

				const collector = message.createMessageComponentCollector({ 
					componentType: ComponentType.Button, time: 1200000,
					filter: (i) => i.user.id == interaction.user.id
				});
				
				collector.on('collect', async (i) => {
					switch (i.customId) {
						case "sorsolas-new-test-btn":
							i.reply({ content: "😎 Beléptél a sorsolásba", ephemeral: true });
						break;
						case "sorsolas-new-send":
							const msg = await channel.send("Betöltés...");
							const start_time = Date.now();
							if (!interaction.guildId) {
								interaction.reply("Váratlan hiba lépet fel: NO_GUILD_ID");
								msg.delete();
								return;
							}
							await db.hSet(`sorsolasok:${interaction.guildId}:${start_time}`, {'guildId': interaction.guildId!, 'channelId': channel.id, 'messageId': msg.id, 'time': time});
							await db.sAdd("sorsolasok", `${interaction.guildId}:${start_time}:${time}`);
							msg.edit({
								content: text+`\n||*\`ID:${sorsolas_id}\`*||`,
								components: [
									new ActionRowBuilder<MessageActionRowComponentBuilder>()
									.addComponents(
										new ButtonBuilder()
										.setCustomId(`sorsolas-register-${start_time}`)
										.setStyle(ButtonStyle.Primary)
										.setEmoji("👍")
										.setLabel("Feliratkozás"),
									)
								]
							});
							i.reply({ content: "✅ A sorsolás elindult", ephemeral: true });
						break;
						case "sorsolas-new-discard":
							i.reply({ content: "❌ Sorsolás elvetve", ephemeral: true });
						break;
					}
				});
				collector.once('end', () => {
					message.edit({ components: [] });
				})
			break;
			case "lezárás":
				const sorsolas_id = options.getInteger("sorsolás_id", true);
				const sorsolas = await db.hGetAll(`sorsolasok:${interaction.guildId}:${sorsolas_id}`);
				if (!sorsolas || !sorsolas.messageId) {
					interaction.reply({ content: "❌ Nincs ilyen sorsolás", ephemeral: true });
					return;
				}
				const winner = await db.sRandMember(`sorsolasok:${interaction.guildId}:${sorsolas_id}:participants`);
				
				const smsg = await (await interaction.guild?.channels.fetch(sorsolas.channelId) as GuildTextBasedChannel)?.messages.fetch(sorsolas.messageId);
				smsg.edit({components: []});
				smsg.reply(`A sorsolást <@${winner}> nyerte 🎉`);
				
				await db.sRem("sorsolasok", `${interaction.guildId}:${sorsolas_id}:${sorsolas.time}`);
				await db.del([`sorsolasok:${interaction.guildId}:${sorsolas_id}`, `sorsolasok:${interaction.guildId}:${sorsolas_id}:participants`]);
				
				await interaction.reply({ content: `✅ A sorsolás lezárva\n**Nyertes:** <@${winner}>`, ephemeral: true });
			break;
		}
	},
} as Command