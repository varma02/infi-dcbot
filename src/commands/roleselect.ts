import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, CommandInteractionOptionResolver, EmbedBuilder, MessagePayload, ModalBuilder, PermissionFlagsBits, RoleSelectMenuBuilder, SlashCommandBuilder, SlashCommandChannelOption, SlashCommandRoleOption, SlashCommandStringOption, SlashCommandSubcommandBuilder, SlashCommandSubcommandGroupBuilder, TextInputBuilder, TextInputStyle, type MessageActionRowComponent, type MessageActionRowComponentBuilder } from "discord.js";
import type { Command } from "../lib/Command";

export default {
	data: new SlashCommandBuilder()
		.setName("roleselector")
		.setDescription("Sends a role selector message in the specified channel")
		// .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
		.addSubcommand(
			new SlashCommandSubcommandBuilder()
			.setName("new")
			.setDescription("Create a new role selector message")
			.addChannelOption(
				new SlashCommandChannelOption()
				.setName("channel")
				.setDescription("Send the role selector to this channel")
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true)
			)
		).addSubcommand(
			new SlashCommandSubcommandBuilder()
			.setName("edit_message")
			.setDescription("Edit the message of the role selector")
			.addChannelOption(
				new SlashCommandChannelOption()
				.setName("channel")
				.setDescription("The channel of the role selector message")
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true)
			).addStringOption(
				new SlashCommandStringOption()
				.setName("id")
				.setDescription("The id of the message you want to edit")
				.setRequired(true)
			)
		).addSubcommand(
			new SlashCommandSubcommandBuilder()
			.setName("remove")
			.setDescription("Remove a role selector")
			.addChannelOption(
				new SlashCommandChannelOption()
				.setName("channel")
				.setDescription("The channel of the role selector message")
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true)
			).addStringOption(
				new SlashCommandStringOption()
				.setName("id")
				.setDescription("The id of the message")
				.setRequired(true)
			)
		).addSubcommand(
			new SlashCommandSubcommandBuilder()
			.setName("add_role")
			.setDescription("Add a role to the list")
			.addChannelOption(
				new SlashCommandChannelOption()
				.setName("channel")
				.setDescription("The channel of the role selector message")
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true)
			).addStringOption(
				new SlashCommandStringOption()
				.setName("id")
				.setDescription("The id of the message you want to update")
				.setRequired(true)
			).addRoleOption(
				new SlashCommandRoleOption()
				.setName("role")
				.setDescription("The role to add")
				.setRequired(true)
			).addStringOption(
				new SlashCommandStringOption()
				.setName("emoji")
				.setDescription("The emoji to display on the button")
				.setRequired(false)
			).addStringOption(
				new SlashCommandStringOption()
				.setName("btn_text")
				.setDescription("The text to display on the button")
				.setRequired(false)
			)
		).addSubcommand(
			new SlashCommandSubcommandBuilder()
			.setName("remove_role")
			.setDescription("Remove a role from the list")
			.addChannelOption(
				new SlashCommandChannelOption()
				.setName("channel")
				.setDescription("The channel of the role selector message")
				.addChannelTypes(ChannelType.GuildText)
				.setRequired(true)
			).addStringOption(
				new SlashCommandStringOption()
				.setName("id")
				.setDescription("The id of the message you want to update")
				.setRequired(true)
			).addRoleOption(
				new SlashCommandRoleOption()
				.setName("role")
				.setDescription("The role to add")
				.setRequired(true)
			)
		),
	async execute(interaction, db) {
		const options = interaction.options as CommandInteractionOptionResolver;
		if (options.getSubcommand() === "new") {
			const channel = options.getChannel("channel", true, [ChannelType.GuildText]);
			const modal = new ModalBuilder()
				.setCustomId("roleselect-new-modal")
				.setTitle("Set the message")
				.addComponents(
					new ActionRowBuilder<TextInputBuilder>()
					.addComponents(
						new TextInputBuilder()
						.setCustomId("roleselect-message")
						.setLabel("You have 5 minutes")
						.setStyle(TextInputStyle.Paragraph)
					)
				);
			await interaction.showModal(modal);
			const response = await interaction.awaitModalSubmit({
				time: 300000, filter: (i) => i.isModalSubmit() && i.customId == "roleselect-new-modal" && i.user.id == interaction.user.id});
			try {
				const message = await channel.send(response.fields.getTextInputValue("roleselect-message"));
				await db.set(`roleselect-messages:${message.guildId}:${message.channelId}:${message.id}`, 1);
				await response.reply({embeds:[new EmbedBuilder().setDescription("Rang választó sikeresen létrehozva").setColor("Blue")]});
			} catch (err) { 
				await response.reply({embeds:[new EmbedBuilder().setDescription("Nem sikerült létrehozni a rang választót").setColor("Red")]});
				console.warn("Failed to create role selector", err);
			}
		} else if (options.getSubcommand() === "edit_message") {
			const modal = new ModalBuilder()
				.setCustomId("roleselect-edit-modal")
				.setTitle("Set the message")
				.addComponents(
					new ActionRowBuilder<TextInputBuilder>()
					.addComponents(
						new TextInputBuilder()
						.setCustomId("roleselect-message")
						.setLabel("You have 5 minutes")
						.setStyle(TextInputStyle.Paragraph)
					)
				);
			await interaction.showModal(modal);
			const response = await interaction.awaitModalSubmit({
				time: 300000, filter: (i) => i.isModalSubmit() && i.customId == "roleselect-edit-modal" && i.user.id == interaction.user.id});
			const channel = options.getChannel("channel", true, [ChannelType.GuildText]);
			const msgid = options.getString("id", true);
			if (await db.get(`roleselect-messages:${channel.guildId}:${channel.id}:${msgid}`)) {
				const message = channel.messages.resolve(msgid)
				if (message) {
					await message.edit(response.fields.getTextInputValue("roleselect-message"));
					await response.reply({embeds:[new EmbedBuilder().setColor("Blue").setDescription("Rang választó frissítve")]});
				} else {
					await response.reply({embeds:[new EmbedBuilder().setColor("Red").setDescription("A megadott üzenet nem található")]});
					await db.del(`roleselect-messages:${channel.guildId}:${channel.id}:${msgid}`);
				}
			}
		} else if (options.getSubcommand() === "remove_message") {
			const channel = options.getChannel("channel", true, [ChannelType.GuildText]);
			const msgid = options.getString("id", true);
			const message = channel.messages.resolve(msgid);
			if (message) {
				await message.delete()
				await interaction.reply({embeds:[new EmbedBuilder().setColor("Blue").setDescription("Rang választó törölve")]});
			} else {
				await interaction.reply({embeds:[new EmbedBuilder().setColor("Red").setDescription("A megadott üzenet nem található")]});
			}
			await db.del(`roleselect-messages:${channel.guildId}:${channel.id}:${msgid}`);
		} else if (options.getSubcommand() === "add_role") {
			const channel = options.getChannel("channel", true, [ChannelType.GuildText]);
			const msgid = options.getString("id", true);
			const role = options.getRole("role", true);
			let btntext = options.getString("btn_text", false);
			const emoji = options.getString("emoji", false);
			if (!(btntext || emoji)) btntext = role.name
			if (await db.get(`roleselect-messages:${channel.guildId}:${channel.id}:${msgid}`)) {
				const message = await channel.messages.fetch(msgid);
				if (message) {
					const btn = new ButtonBuilder()
					.setCustomId(`roleselect-${role.id}`)
					.setStyle(ButtonStyle.Primary);
					if (btntext) btn.setLabel(btntext);
					if (emoji) btn.setEmoji(emoji);
					const msgcomponents = [...message.components];
					console.log(msgcomponents[0]);
					// await message.edit({components:[]});
					await message.edit({components: [
						new ActionRowBuilder<MessageActionRowComponentBuilder>()
						.setComponents(msgcomponents[0] ? msgcomponents[0].components.map(v => new ButtonBuilder(v.data as any)) : [])
						.addComponents(btn)
					]});
					await interaction.reply({embeds:[new EmbedBuilder().setColor("Blue").setDescription("Rang választó frissítve")]});
				} else {
					await interaction.reply({embeds:[new EmbedBuilder().setColor("Red").setDescription("A megadott üzenet nem található")]});
					await db.del(`roleselect-messages:${channel.guildId}:${channel.id}:${msgid}`);
				}
			} else {
				await interaction.reply({embeds:[new EmbedBuilder().setColor("Red").setDescription("A megadott üzenet nem található")]});
			}
		} else if (options.getSubcommand() === "remove_role") {
			const channel = options.getChannel("channel", true, [ChannelType.GuildText]);
			const msgid = options.getString("id", true);
			const role = options.getRole("role", true);
			if (await db.get(`roleselect-messages:${channel.guildId}:${channel.id}:${msgid}`)) {
				const message = await channel.messages.fetch(msgid);
				if (message) {
					const msgcomponents = [...message.components];
					console.log(msgcomponents);
					// await message.edit({components:[]});
					await message.edit({components: 
						msgcomponents[0] && msgcomponents[0].components.length-1 ? [
						new ActionRowBuilder<MessageActionRowComponentBuilder>()
						.setComponents(msgcomponents[0].components
							.filter(v => v.customId != `roleselect-${role.id}`)
							.map(v => new ButtonBuilder(v.data as any)))
					] : []});
					await interaction.reply({embeds:[new EmbedBuilder().setColor("Blue").setDescription("Rang választó frissítve")]});
				} else await interaction.reply({embeds:[new EmbedBuilder().setColor("Red").setDescription("A megadott üzenet nem található")]});
			} else await interaction.reply({embeds:[new EmbedBuilder().setColor("Red").setDescription("A megadott üzenet nem található")]});
		}
	},
} as Command