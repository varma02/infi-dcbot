import { 
	CommandInteractionOptionResolver,
	SlashCommandBuilder, 
	SlashCommandSubcommandBuilder, 
	SlashCommandUserOption,
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
		),
		
	async execute(interaction, db) {
		const options = interaction.options as CommandInteractionOptionResolver;
		if (options.getSubcommand() === "ranglista") {
			const users = await db.hGetAll(`xp:${interaction.guildId}`);
			const sorted = Object.entries(users).sort((a, b) => parseInt(b[1]) - parseInt(a[1]));
			if (!sorted.length) return await interaction.reply("Még senki nem szerezett XP-t");
			await interaction.reply(`${lang.xp_ranklist}\n${sorted.slice(0, 10).map((user, index) => `**#${index + 1}** <@${user[0]}> - ${user[1]} XP`).join("\n")}`);

		} else if (options.getSubcommand() === "xp") {
			const user = options.getUser("felhasználó") || interaction.user;
			const xp = await db.hGet(`xp:${interaction.guildId}`, user.id);
			await interaction.reply(lang.xp_user.replace("{1}", `<@${user.id}>`).replace("{2}", xp || "0"));
		}
	}
} as Command;