import { 
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	CommandInteractionOptionResolver,
	ComponentType,
	PermissionFlagsBits,
	SlashCommandBuilder, 
	SlashCommandIntegerOption, 
	SlashCommandSubcommandBuilder,
	type MessageActionRowComponentBuilder,
} from "discord.js";
import type { Command } from "../lib/Command";
import lang from "../lang";


export default {
	data: new SlashCommandBuilder()
		.setName("xp_admin")
		.setDescription("XP rendszer adminisztrátor parancsai")
		.setDMPermission(false)
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(
			new SlashCommandSubcommandBuilder()
			.setName("nullázás")
			.setDescription("Minden felhasználó XP-jének nullázása")
		).addSubcommand(
            new SlashCommandSubcommandBuilder()
            .setName("szorzó_beállítása")
            .setDescription("XP szorzó beállítása")
            .addIntegerOption(
                new SlashCommandIntegerOption()
                .setName("voice")
                .setDescription("Voice csatornában eltöltött percekért kapott XP")
                .setRequired(false)
            )
            .addIntegerOption(
                new SlashCommandIntegerOption()
                .setName("üzenet")
                .setDescription("Üzenetenként kapott XP")
                .setRequired(false)
            )
        ),
		
	async execute(interaction, db) {
		const options = interaction.options as CommandInteractionOptionResolver;
		console.debug(`Executing command xp with subcommand ${options.getSubcommand()}`);

		if (options.getSubcommand() === "nullázás") {
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
				reply.edit({ components: [] }).catch(() => {});
			});


		} else if (options.getSubcommand() === "szorzó_beállítása") {
            const voice = options.getInteger("voice", false);
            const message = options.getInteger("üzenet", false);
            if (voice) await db.set(`xp_multiplier:${interaction.guildId}:voice`, voice);
            if (message) await db.set(`xp_multiplier:${interaction.guildId}:message`, message);
            await interaction.reply({ content: lang.xp_multiplier_set, ephemeral: true });
        }
	}
} as Command;