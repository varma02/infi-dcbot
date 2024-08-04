import type { RedisClientType } from "@redis/client";
import { Client, Collection, EmbedBuilder, Events, type ClientOptions } from "discord.js";
import type { Command } from "./Command";
import { Glob } from "bun";

export class CustomClient extends Client {
	commands: Collection<string, Command>;

	constructor(options: ClientOptions & {database: RedisClientType<any, any, any>}) {
		super(options)
		this.once(Events.ClientReady, () => console.log(`Logged in as ${this.user!.tag}`));
		
		this.commands = new Collection();
		this.reloadCommands();
		if (process.env.REGISTER_COMMANDS_AT_STARTUP) {
			this.registerCommands();
		}

		this.on(Events.InteractionCreate, async (interaction) => {
			if (interaction.isCommand()) {
				const command = this.commands.get(interaction.commandName);
				if (command) {
					try {
						await command.execute(interaction);
					} catch {
						if (!interaction.replied) interaction.reply({embeds: [new EmbedBuilder().setDescription("An unexpected error has occured").setColor("Red")]});
						console.warn(`Command \`${interaction.commandName}\` returned with an error`);
					}
				} else {
					interaction.reply({embeds: [new EmbedBuilder().setDescription("Command not found").setColor("Red")]});
					console.warn(`Unable to find command: ${interaction.commandName}`);
				}
			}
		});

		this.on(Events.GuildMemberAdd, async (member) => {
			console.log(`${member.user.tag} has joined ${member.guild.name}`);
			if (!member.user.bot) {
				if (!member.dmChannel) await member.createDM();
				if (member.dmChannel) member.dmChannel.send("hihi");
			}
		});
	}

	reloadCommands() {
		this.commands = new Collection();
		const commandsDir = __dirname.replace("lib", "") + "commands/";
		for (const filename of new Glob("*.ts").scanSync({ cwd: commandsDir, onlyFiles: true, followSymlinks: false })) {
			const command:Command = require(commandsDir + filename);
			if ('data' in command && 'execute' in command) {
				this.commands.set(command.data.name, command);
			} else {
				console.warn(`Failed to load command from ${filename}`);
			}
		}
		console.log("Loaded slash commands");
	}

	registerCommands() {
		if (process.env.GUILD_ID) {
			const guild = this.guilds.resolve(process.env.GUILD_ID)
			if (guild) {
				guild.commands.set([...this.commands.values()].map((command) => command.data))
				console.log("Registering slash commands to guild");
				return;
			}
		} else if (this.application) {
			this.application.commands.set([...this.commands.values()].map((command) => command.data))
			console.log("Registering slash commands to application");
			return;
		}
		console.log("Unable to register slash commands");
	}
}