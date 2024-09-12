import { 
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	CommandInteractionOptionResolver,
	ComponentType,
	SlashCommandBuilder, 
	SlashCommandSubcommandBuilder, 
	SlashCommandUserOption,
	type MessageActionRowComponentBuilder,
} from "discord.js";
import type { Command } from "../lib/Command";
import lang from "../lang";


export default {
	data: new SlashCommandBuilder()
		.setName("xp")
		.setDescription("XP rendszer parancsai")
		.setDMPermission(false)
		.addSubcommand(
			new SlashCommandSubcommandBuilder()
			.setName("ranglista")
			.setDescription("XP ranglista")
		).addSubcommand(
			new SlashCommandSubcommandBuilder()
			.setName("xp")
			.setDescription("Egy felhasználó XP-je")
			.addUserOption(
				new SlashCommandUserOption()
				.setName("felhasználó")
				.setDescription("A felhasználó")
				.setRequired(false)
			)
		).addSubcommand(
			new SlashCommandSubcommandBuilder()
			.setName("nullázás")
			.setDescription("Minden felhasználó XP-jének nullázása")
		),
		
	async execute(interaction, db) {
		const options = interaction.options as CommandInteractionOptionResolver;
		console.debug(`Executing command xp with subcommand ${options.getSubcommand()}`);
		if (options.getSubcommand() === "ranglista") {
			const users = await db.hGetAll(`xp:${interaction.guildId}`);
			const sorted = Object.entries(users).sort((a, b) => parseInt(b[1]) - parseInt(a[1]));
			if (!sorted.length) return await interaction.reply("Még senki nem szerezett XP-t");
			await interaction.reply(`${lang.xp_ranklist}\n${sorted.slice(0, 10).map((user, index) => `**#${index + 1}** <@${user[0]}> - ${user[1]} XP`).join("\n")}`);

		} else if (options.getSubcommand() === "xp") {
			const user = options.getUser("felhasználó") || interaction.user;
			const xp = await db.hGet(`xp:${interaction.guildId}`, user.id);
			await interaction.reply(lang.xp_user.replace("{1}", `<@${user.id}>`).replace("{2}", xp || "0"));
		} else if (options.getSubcommand() === "nullázás") {
			const reply = await interaction.reply({
				content: lang.xp_reset_confirm,
				ephemeral: true,
				components: [
					new ActionRowBuilder<MessageActionRowComponentBuilder>()
					.addComponents(
						new ButtonBuilder()
						.setStyle(ButtonStyle.Danger)
						.setCustomId("xp-reset-confirm")
						.setLabel(lang.xp_reset_confirm_btn),
						new ButtonBuilder()
						.setStyle(ButtonStyle.Secondary)
						.setCustomId("xp-reset-cancel")
						.setLabel(lang.xp_reset_cancel_btn)
					)
				]
			});
			const collector = reply.createMessageComponentCollector({ componentType: ComponentType.Button, time: 1200000, filter: (i) => i.user.id == interaction.user.id });
			collector.on("collect", async (i) => {
				if (i.customId === "xp-reset-confirm") {
					await db.del(`xp:${interaction.guildId}`);
					await i.reply({ content: lang.xp_reset_done, ephemeral: true });
				} else if (i.customId === "xp-reset-cancel") {
					await i.reply({ content: lang.xp_reset_cancel, ephemeral: true });
				}
			});
			collector.once("end", () => {
				if (reply) reply.edit({ components: [] });
			});
		}
	}
} as Command;