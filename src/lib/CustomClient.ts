import type { RedisClientType } from "@redis/client";
import { Client, Collection, EmbedBuilder, Events, type ClientOptions } from "discord.js";
import type { Command } from "./Command";
import { Glob } from "bun";
import type { LanguagePack } from "./LanguagePack";

export class CustomClient extends Client {
	commands: Collection<string, Command>;
	lang: LanguagePack;
	db: RedisClientType<any, any, any>;

	constructor(options: ClientOptions & {database: RedisClientType<any, any, any>, language: LanguagePack}) {
		super(options)
		this.lang = options.language
		this.db = options.database

		this.once(Events.ClientReady, () => {
			console.log(`Logged in as ${this.user!.tag}`)
			if (process.env.REGISTER_COMMANDS_AT_STARTUP == "1") {
				this.registerCommands();
			}
		});

		this.commands = new Collection();
		this.reloadCommands();

		this.on(Events.InteractionCreate, async (interaction) => {
			if (interaction.isCommand()) {
				const command = this.commands.get(interaction.commandName);
				if (command) {
					try {
						await command.execute(interaction, this.lang, this.db);
					} catch (err) {
						if (!interaction.replied) interaction.reply({embeds: [new EmbedBuilder().setDescription(this.lang.commandUnexpectedFail).setColor("Red")]});
						console.warn(`Command \`${interaction.commandName}\` returned with an error`, err);
					}
				} else {
					interaction.reply({embeds: [new EmbedBuilder().setDescription(this.lang.commandNotFound).setColor("Red")]});
					console.warn(`Unable to find command: ${interaction.commandName}`);
				}
			} else if (interaction.isMessageComponent()) {
				if (interaction.customId.startsWith("roleselect-") && await this.db.get(`roleselect-messages:${interaction.guildId}:${interaction.channelId}:${interaction.message.id}`)) {
					try {
						await interaction.guild?.members.resolve(interaction.user.id)?.roles.add(interaction.customId.split("-")[1]),
						await interaction.reply({embeds: [new EmbedBuilder().setColor("Blue").setDescription(this.lang.roleselectorUserRolesUpdated.replace("{role}", `<@&${interaction.customId.split("-")[1]}>`))], ephemeral: true});
					} catch (err) {
						if (!interaction.replied) interaction.reply({embeds: [new EmbedBuilder().setColor("Red").setDescription(this.lang.commandUnexpectedFail)], ephemeral: true});
						console.warn(err);
					}
				}
			}
		});

		this.on(Events.GuildMemberAdd, async (member) => {
			const welcomemsg = await this.db.get("welcome-message")
			if (!member.user.bot && welcomemsg) {
				if (!member.dmChannel) await member.createDM();
				if (member.dmChannel) member.dmChannel.send(welcomemsg.replace("<@user>", `<@${member.id}>`))
				// if (member.dmChannel) member.dmChannel.send({embeds:[new EmbedBuilder()
				// 	.setTitle("Welcome to X server")
				// 	.setDescription("I hope you have a great time here. Lorem ipsum dolor sit amet, consectetur adipisicing elit. Sit pariatur consequatur nihil, at dolor harum modi cum similique iusto voluptatibus ut natus eaque ad beatae blanditiis excepturi omnis velit. Recusandae quo ipsa corporis, quos quasi, eius eligendi sit vero illo molestias ducimus voluptate qui. Dolor blanditiis culpa, aliquid, praesentium facilis enim quo numquam, labore iusto atque ipsa rem doloremque odit id consequatur excepturi quis. Ducimus reiciendis necessitatibus error ipsam fugiat cumque repudiandae sint reprehenderit, libero omnis natus quasi modi porro, saepe adipisci officiis magnam! Veniam quia minima asperiores dolores deserunt assumenda quaerat quas, dolore, aspernatur ducimus, consectetur aperiam! Assumenda, inventore?")
				// 	.addFields([
				// 		{name: "Rules", value: "1. Don't swear\n2.Some rule\n3. Don't do something\n4. Be respectful"},
				// 		{name: "How to engage", value: "#channel is for X\n#other-channel is where you discuss Y"},
				// 	])
				// 	.setFooter({text:"Stay safe out there - Server owner(s)"})
				// 	.setColor("Aqua")
				// 	.setImage("https://i.ytimg.com/vi/6FNHe3kf8_s/maxresdefault.jpg")
				// ]});
			}
		});
	}

	reloadCommands() {
		this.commands = new Collection();
		const commandsDir = __dirname.replace("lib", "") + "commands/";
		for (const filename of new Glob("*.ts").scanSync({ cwd: commandsDir, onlyFiles: true, followSymlinks: false })) {
			const command: Command = require(commandsDir + filename).default;
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
					.catch((err)=>console.warn(`Failed to register slash commands`, err))
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