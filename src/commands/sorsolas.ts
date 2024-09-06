import { ActionRowBuilder, ButtonBuilder, ChannelType, CommandInteractionOptionResolver, EmbedBuilder, type MessageActionRowComponentBuilder, ModalBuilder, SlashCommandBuilder, SlashCommandChannelOption, SlashCommandSubcommandBuilder, TextInputBuilder, TextInputStyle, type ModalActionRowComponentBuilder, ButtonStyle, ComponentType } from "discord.js";
import type { Command } from "../lib/Command";

export default {
	data: new SlashCommandBuilder()
	.setName("sorsolás")
	.setDescription("Sorsolások kezelése, szerkesztése, lezárása")
	.addSubcommand(
		new SlashCommandSubcommandBuilder()
		.setName("új")
		.setDescription("Új sorsolás készítése")
		.addChannelOption(
			new SlashCommandChannelOption()
			.setName("szöveges_csatorna")
			// .setDescription("Szöveges csatorna")
			.addChannelTypes(ChannelType.GuildText)
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

				const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 1200000 });
				collector.on('collect', async (i) => {
					if (i.user.id !== interaction.user.id) return;
					switch (i.customId) {
						case "sorsolas-new-test-btn":
							i.reply({ content: "😎 Beléptél a sorsolásba", ephemeral: true });
						break;
						case "sorsolas-new-send":
							const sorsolas_id = Date.now();
							await db.lPush("sorsolasok", `${interaction.guildId}:${sorsolas_id}:${time}`);
							channel.send({ 
								content: text, 
								components: [
									new ActionRowBuilder<MessageActionRowComponentBuilder>()
									.addComponents(
										new ButtonBuilder()
										.setCustomId(`sorsolas-${interaction.guildId}-${sorsolas_id}`)
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
		}

		// if (options.getSubcommand() === "new") {
		// 	await interaction.showModal(
		// 		new ModalBuilder()
		// 		.setCustomId("lottery-new-modal")
		// 		.setTitle("Create new lottery")
		// 		.addComponents(
		// 			new ActionRowBuilder<ModalActionRowComponentBuilder>()
		// 			.addComponents(
		// 				new TextInputBuilder()
		// 				.setCustomId("lottery-new-time")
		// 				.setLabel("Time (in hours)")
		// 				.setStyle(TextInputStyle.Short)
		// 				.setRequired(true)
		// 			),
		// 			new ActionRowBuilder<ModalActionRowComponentBuilder>()
		// 			.addComponents(
		// 				new TextInputBuilder()
		// 				.setCustomId("lottery-new-btnemoji")
		// 				.setLabel("Button emoji")
		// 				.setStyle(TextInputStyle.Short)
		// 				.setRequired(true)
		// 			),
		// 			new ActionRowBuilder<ModalActionRowComponentBuilder>()
		// 			.addComponents(
		// 				new TextInputBuilder()
		// 				.setCustomId("lottery-new-btntext")
		// 				.setLabel("Button text")
		// 				.setStyle(TextInputStyle.Short)
		// 				.setRequired(false)
		// 			),
		// 			new ActionRowBuilder<ModalActionRowComponentBuilder>()
		// 			.addComponents(
		// 				new TextInputBuilder()
		// 				.setCustomId("lottery-new-message")
		// 				.setLabel("Message")
		// 				.setStyle(TextInputStyle.Paragraph)
		// 				.setRequired(true)
		// 			)
		// 		)
		// 	);
			
		// 	const response = await interaction.awaitModalSubmit({
		// 		time: 300000, filter: (i) => i.isModalSubmit() && i.customId == "lottery-new-modal" && i.user.id == interaction.user.id});
			
		// 	try {
		// 		const time = parseFloat(response.fields.getTextInputValue("lottery-new-time"));
		// 		const btnemoji = response.fields.getTextInputValue("lottery-new-btnemoji");
		// 		const btntext = response.fields.getTextInputValue("lottery-new-btntext");
		// 		const text = response.fields.getTextInputValue("lottery-new-message");
		// 		const channel = options.getChannel("channel", true, [ChannelType.GuildText]);
	
		// 		try {
		// 			const msg = await channel.send({content: text, components:[
		// 				new ActionRowBuilder<MessageActionRowComponentBuilder>()
		// 				.addComponents(
		// 					new ButtonBuilder()
		// 					.setCustomId("lottery-register")
		// 					.setEmoji(btnemoji)
		// 					.setLabel(btntext)
		// 					.setStyle(ButtonStyle.Primary)
		// 				)
		// 			]});
		// 			await db.sAdd("lotteries", `${msg.guildId}:${msg.channelId}:${msg.id}:${Date.now() + Math.floor(time * 3600000)}`);
		// 		} catch (err) {
		// 			console.warn(err);
		// 			await response.reply({embeds:[new EmbedBuilder().setColor("Red").setDescription("Failed to send message.")]});
		// 		}
		// 	} catch (err) {
		// 		console.warn(err);
		// 		await response.reply({embeds:[new EmbedBuilder().setColor("Red").setDescription("Failed to parse inputs.")]});
		// 	}
		// }
	},
} as Command