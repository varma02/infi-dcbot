import { 
	ActionRowBuilder, 
	ButtonBuilder, 
	ButtonStyle, 
	ChannelType, 
	CommandInteractionOptionResolver, 
	ComponentType, 
	ModalBuilder, 
	PermissionFlagsBits, 
	PermissionOverwriteManager, 
	PermissionOverwrites, 
	PermissionsBitField, 
	SlashCommandBuilder, 
	SlashCommandChannelOption, 
	SlashCommandNumberOption, 
	SlashCommandRoleOption, 
	SlashCommandStringOption, 
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
		.setDMPermission(false)
		.setName("ticket")
		.setDescription("Ticketek létrehozása, szerkesztése, törlése")
		.addSubcommand(
			new SlashCommandSubcommandBuilder()
			.setName("új_üzenet")
			.setDescription("Ticket üzenet létrehozása")
			.addChannelOption(
				new SlashCommandChannelOption()
				.setName("csatorna")
				.setDescription("🤯")
				.setRequired(true)
			)
		).addSubcommand(
			new SlashCommandSubcommandBuilder()
			.setName("törlés")
			.setDescription("Meglévő ticket törlése")
			.addStringOption(
				new SlashCommandStringOption()
				.setName("id")
				.setDescription("A ticket azonosítója")
				.setRequired(true)
			)
		).addSubcommand(
			new SlashCommandSubcommandBuilder()
			.setName("státusz")
			.setDescription("Ticket státuszának módosítása")
			.addStringOption(
				new SlashCommandStringOption()
				.setName("id")
				.setDescription("A ticket azonosítója")
				.setRequired(true)
			).addStringOption(
				new SlashCommandStringOption()
				.setName("státusz")
				.setDescription("Az új státusz")
				.setRequired(true)
				.setChoices([
					{ name: "Nyitott", value: "ticket_status_open" },
					{ name: "Lezárt", value: "ticket_status_closed" },
					{ name: "Folyamatban", value: "ticket_status_inprogress" },
				])
			)
		).addSubcommand(
			new SlashCommandSubcommandBuilder()
			.setName("kategória_beállítása")
			.setDescription("Ticket kategória beállítása")
			.addStringOption(
				new SlashCommandStringOption()
				.setName("id")
				.setDescription("Az csatorna kategória azonosítója")
				.setRequired(true)
			)
		).addSubcommand(
			new SlashCommandSubcommandBuilder()
			.setName("rang_beállítása")
			.setDescription("Ticket kezelő rang beállítása")
			.addRoleOption(
				new SlashCommandRoleOption()
				.setName("rang")
				.setDescription("A rang 🤯")
				.setRequired(true)
			)
		),
		
	async execute(interaction, db) {
		const options = interaction.options as CommandInteractionOptionResolver;
		console.debug(`Executing command ticket with subcommand ${options.getSubcommand()}`);
		const ticket_settings = await db.hGetAll(`ticket:${interaction.guildId}`);
		if (options.getSubcommand() === "új") {
			await interaction.showModal(
				new ModalBuilder()
				.setCustomId("ticket-new-modal")
				.setTitle(lang.ticket_new_modal_title)
				.addComponents(
					new ActionRowBuilder<ModalActionRowComponentBuilder>()
					.addComponents(
						new TextInputBuilder()
						.setCustomId("ticket-new-msg")
						.setLabel(lang.ticket_new_modal_text)
						.setStyle(TextInputStyle.Paragraph)
						.setRequired(true)
					)
				)
			);
			
			const modal_response = await interaction.awaitModalSubmit({
				time: 1200000, filter: (i) => i.isModalSubmit() && i.customId == "ticket-new-modal" && i.user.id == interaction.user.id});

			const text = modal_response.fields.getTextInputValue("ticket-new-msg");
			const ticket_id = Date.now();
			const channel = await interaction.guild?.channels.create({
				name: `ticket-${ticket_id}`, 
				type: ChannelType.GuildText, 
				parent: ticket_settings.category, 
				permissionOverwrites: [
					{id: interaction.guild.roles.everyone, deny: PermissionFlagsBits.ViewChannel},
					{id: interaction.user.id, allow: PermissionFlagsBits.ViewChannel},
					{id: ticket_settings.role, allow: PermissionFlagsBits.ViewChannel}
				]
			});
			if (!channel) {
				modal_response.reply({content: lang.ticket_new_channel_create_failed, ephemeral: true});
				return;
			}
			await channel.send({
				content: `${text}\n*||ID: ${ticket_id}||*`, 
				components: [
				new ActionRowBuilder<MessageActionRowComponentBuilder>()
				.addComponents(
					new ButtonBuilder()
					.setStyle(ButtonStyle.Danger)
					.setCustomId(`ticket-close-${ticket_id}`)
					.setLabel(lang.ticket_close)
				)
			]});
			await db.hSet(`ticket:${interaction.guildId}:${ticket_id}`, {user:interaction.user.id, channel: channel.id, status: "ticket_status_open"});
			
			await modal_response.reply({content: lang.ticket_created.replace("{1}", `<#${channel.id}>`), ephemeral: true});


		} else if (options.getSubcommand() === "törlés") {
			if (!interaction.member?.permissions.has(PermissionFlagsBits.Administrator) && 
			!interaction.member?.roles.cache.has(ticket_settings.role)) {
				await interaction.reply({content: lang.ticket_no_rights, ephemeral: true});
				return;
			}
			const ticket_id = options.getString("id", true);
			const ticket = await db.hGetAll(`ticket:${interaction.guildId}:${ticket_id}`);
			if (!ticket) {
				await interaction.reply({content: lang.ticket_not_found, ephemeral: true});
				return;
			}
			const channel = interaction.guild?.channels.cache.get(ticket.channel);
			if (channel) await channel.delete();
			await db.del(`ticket:${interaction.guildId}:${ticket_id}`);
			if (!interaction.replied && interaction.channel) await interaction.reply({content: lang.ticket_deleted, ephemeral: true});


		} else if (options.getSubcommand() === "státusz") {
			if (!interaction.member?.permissions.has(PermissionFlagsBits.Administrator) && 
			!interaction.member?.roles.cache.has(ticket_settings.role)) {
				await interaction.reply({content: lang.ticket_no_rights, ephemeral: true});
				return;
			}
			const ticket_id = options.getString("id", true);
			const status = options.getString("státusz", true);
			const ticket = await db.hGetAll(`ticket:${interaction.guildId}:${ticket_id}`);
			if (!ticket) {
				await interaction.reply({content: lang.ticket_not_found, ephemeral: true});
				return;
			}
			const channel = interaction.guild?.channels.cache.get(ticket.channel) as GuildTextBasedChannel;
			if (channel) {
				await channel.send({content: lang.ticket_status_changed.replace("{1}", lang.ticket_statuses[status])});
			}
			if (status == "ticket_status_closed") {
				await channel?.edit({permissionOverwrites: [
					{id: interaction.guild!.roles.everyone, deny: PermissionFlagsBits.ViewChannel},
					{id: interaction.user.id, allow: PermissionFlagsBits.ViewChannel, deny: PermissionFlagsBits.SendMessages},
					{id: ticket_settings.role, allow: PermissionFlagsBits.ViewChannel}
				]});
			}
			await db.hSet(`ticket:${interaction.guildId}:${ticket_id}`, "status", status);
			await interaction.reply({content: lang.ticket_status_changed.replace("{1}", lang.ticket_statuses[status]), ephemeral: true});


		} else if (options.getSubcommand() === "kategória_beállítása") {
			if (!interaction.member?.permissions.has(PermissionFlagsBits.Administrator)) {
				await interaction.reply({content: lang.ticket_no_rights, ephemeral: true});
				return;
			}
			const category_id = options.getString("id", true);
			await db.hSet(`ticket:${interaction.guildId}`, "category", category_id);
			await interaction.reply({content: lang.ticket_category_changed.replace("{1}", `<#${category_id}>`), ephemeral: true});


		} else if (options.getSubcommand() === "rang_beállítása") {
			if (!interaction.member?.permissions.has(PermissionFlagsBits.Administrator)) {
				await interaction.reply({content: lang.ticket_no_rights, ephemeral: true});
				return;
			}
			const role = options.getRole("rang", true);
			await db.hSet(`ticket:${interaction.guildId}`, "role", role.id);
			await interaction.reply({content: lang.ticket_role_changed.replace("{1}", `<@&${role.id}>`), ephemeral: true});
		}
	}
} as Command;