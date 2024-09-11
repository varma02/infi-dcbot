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

const ticket_statuses:any = {
	"ticket_status_open" : "Nyitott",
	"ticket_status_closed" : "Lezárt",
	"ticket_status_inprogress" : "Folyamatban",
}

export default {
	data: new SlashCommandBuilder()
		.setDMPermission(false)
		.setName("ticket")
		.setDescription("Ticketek létrehozása, szerkesztése, törlése")
		.addSubcommand(
			new SlashCommandSubcommandBuilder()
			.setName("új")
			.setDescription("Új ticket létrehozása")
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
		const ticket_settings = await db.hGetAll(`ticket:${interaction.guildId}`);
		if (options.getSubcommand() === "új") {
			await interaction.showModal(
				new ModalBuilder()
				.setCustomId("ticket-new-modal")
				.setTitle("Új ticket létrehozása")
				.addComponents(
					new ActionRowBuilder<ModalActionRowComponentBuilder>()
					.addComponents(
						new TextInputBuilder()
						.setCustomId("ticket-new-msg")
						.setLabel("Üzenet")
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
				modal_response.reply({content: "Hiba történt a csatorna létrehozása közben", ephemeral: true});
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
					.setLabel("Lezárás")
				)
			]});
			await db.hSet(`ticket:${interaction.guildId}:${ticket_id}`, {user:interaction.user.id, channel: channel.id, status: "ticket_status_open"});
			
			await modal_response.reply({content: "Ticket létrehozva, a továbbiakat ebben a csatornában látod: {1}".replace("{1}", `<#${channel.id}>`), ephemeral: true});


		} else if (options.getSubcommand() === "törlés") {
			if (!interaction.member?.permissions.has(PermissionFlagsBits.Administrator) && 
			!interaction.member?.roles.cache.has(ticket_settings.role)) {
				await interaction.reply({content: "Nincs jogosultságod a ticketek törlésére", ephemeral: true});
				return;
			}
			const ticket_id = options.getString("id", true);
			const ticket = await db.hGetAll(`ticket:${interaction.guildId}:${ticket_id}`);
			if (!ticket) {
				await interaction.reply({content: "Nincs ilyen ticket", ephemeral: true});
				return;
			}
			const channel = interaction.guild?.channels.cache.get(ticket.channel);
			if (channel) await channel.delete();
			await db.del(`ticket:${interaction.guildId}:${ticket_id}`);
			if (!interaction.replied && interaction.channel) await interaction.reply({content: "Ticket törölve", ephemeral: true});


		} else if (options.getSubcommand() === "státusz") {
			if (!interaction.member?.permissions.has(PermissionFlagsBits.Administrator) && 
			!interaction.member?.roles.cache.has(ticket_settings.role)) {
				await interaction.reply({content: "Nincs jogosultságod a ticket módosítására", ephemeral: true});
				return;
			}
			const ticket_id = options.getString("id", true);
			const status = options.getString("státusz", true);
			const ticket = await db.hGetAll(`ticket:${interaction.guildId}:${ticket_id}`);
			if (!ticket) {
				await interaction.reply({content: "Nincs ilyen ticket", ephemeral: true});
				return;
			}
			const channel = interaction.guild?.channels.cache.get(ticket.channel) as GuildTextBasedChannel;
			if (channel) {
				await channel.send({content: `A ticket állapota megváltozott: ${ticket_statuses[status]}`});
			}
			if (status == "ticket_status_closed") {
				await channel?.edit({permissionOverwrites: [
					{id: interaction.guild!.roles.everyone, deny: PermissionFlagsBits.ViewChannel},
					{id: interaction.user.id, allow: PermissionFlagsBits.ViewChannel, deny: PermissionFlagsBits.SendMessages},
					{id: ticket_settings.role, allow: PermissionFlagsBits.ViewChannel}
				]});
			}
			await db.hSet(`ticket:${interaction.guildId}:${ticket_id}`, "status", status);
			await interaction.reply({content: `Státusz módosítva: ${ticket_statuses[status]}`, ephemeral: true});


		} else if (options.getSubcommand() === "kategória_beállítása") {
			if (!interaction.member?.permissions.has(PermissionFlagsBits.Administrator)) {
				await interaction.reply({content: "Nincs jogosultságod a beállítások módosítására", ephemeral: true});
				return;
			}
			const category_id = options.getString("id", true);
			await db.hSet(`ticket:${interaction.guildId}`, "category", category_id);
			await interaction.reply({content: `Kategória beállítva: <#${category_id}>`, ephemeral: true});


		} else if (options.getSubcommand() === "rang_beállítása") {
			if (!interaction.member?.permissions.has(PermissionFlagsBits.Administrator)) {
				await interaction.reply({content: "Nincs jogosultságod a beállítások módosítására", ephemeral: true});
				return;
			}
			const role = options.getRole("rang", true);
			await db.hSet(`ticket:${interaction.guildId}`, "role", role.id);
			await interaction.reply({content: `Rang beállítva: <@&${role.id}>`, ephemeral: true});
		}
	}
} as Command;