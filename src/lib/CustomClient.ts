import type { RedisClientType } from "@redis/client";
import { Client, Collection, EmbedBuilder, Events, TextChannel, type ClientOptions, type GuildTextBasedChannel } from "discord.js";
import type { Command } from "./Command";
import { Glob } from "bun";

export class CustomClient extends Client {
	commands: Collection<string, Command>;
	db: RedisClientType<any, any, any>;

	constructor(options: ClientOptions & {database: RedisClientType<any, any, any>}) {
		super(options)
		this.db = options.database
		this.commands = new Collection();
		this.reloadCommands();

		this.on(Events.InteractionCreate, async (interaction) => {
			if (interaction.isCommand()) {
				const command = this.commands.get(interaction.commandName);
				if (command) {
					try {
						await command.execute(interaction, this.db);
					} catch (err) {
						if (!interaction.replied) interaction.reply({embeds: [new EmbedBuilder().setDescription("Váratlan hiba történt").setColor("Red")]});
						console.warn(`Command \`${interaction.commandName}\` returned with an error`, err);
					}
				} else {
					interaction.reply({embeds: [new EmbedBuilder().setDescription("Nincs ilyen parancs").setColor("Red")]});
					console.warn(`Unable to find command: ${interaction.commandName}`);
				}
			} else if (interaction.isButton()) {
				if (interaction.customId.startsWith("sorsolas-register-")) {
					await this.db.sAdd(`sorsolasok:${interaction.guildId}:${interaction.customId.split("-")[1]}:participants`, interaction.user.id);
					await interaction.reply({embeds: [new EmbedBuilder().setColor("Blue").setDescription(`Jelentkezés bejegyzve 😎`)], ephemeral: true});
				}
			}
			// else if (interaction.isMessageComponent()) {
			// 	if (interaction.customId.startsWith("roleselect-") && await this.db.get(`roleselect-messages:${interaction.guildId}:${interaction.channelId}:${interaction.message.id}`)) {
			// 		try {
			// 			await interaction.guild?.members.resolve(interaction.user.id)?.roles.add(interaction.customId.split("-")[1]),
			// 			await interaction.reply({embeds: [new EmbedBuilder().setColor("Blue").setDescription(`a`)], ephemeral: true});
			// 		} catch (err) {
			// 			if (!interaction.replied) interaction.reply({embeds: [new EmbedBuilder().setColor("Red").setDescription("Váratlan hiba történt")], ephemeral: true});
			// 			console.warn(err);
			// 		}
			// 	} else if (interaction.customId === "lottery-register") {
			// 		await this.db.sAdd(`lottery-users:${interaction.guildId}:${interaction.channelId}:${interaction.message.id}`, interaction.user.id);
			// 		await interaction.reply({embeds:[new EmbedBuilder().setColor("Blue").setDescription("Sikeresen bejelentkeztél a sorsolásra")], ephemeral:true});
			// 	}
			// }
		});

		this.once(Events.ClientReady, () => {
			setInterval(async () => {
				const sorsolasok = await this.db.sMembers("sorsolasok");
				for (const sorsolas of sorsolasok) {
					const ss = sorsolas.split(":");
					if (parseInt(ss[1]) + parseFloat(ss[2]) * 60000 <= Date.now() ) {
						const sorsolas_id = parseInt(ss[1]);
						const guildId = parseInt(ss[0]);
						const sorsolas = await this.db.hGetAll(`sorsolasok:${ss[0]}:${sorsolas_id}`);
						if (!sorsolas || !sorsolas.messageId) continue;
						const winner = await this.db.sRandMember(`sorsolasok:${guildId}:${sorsolas_id}:participants`);
						
						const smsg = await (await this.channels.fetch(sorsolas.channelId) as GuildTextBasedChannel)?.messages.fetch(sorsolas.messageId);
						smsg.edit({components: []});
						smsg.reply(`A sorsolást <@${winner}> nyerte 🎉`);
						
						await this.db.sRem("sorsolasok", `${guildId}:${sorsolas_id}:${sorsolas.time}`);
						await this.db.del([`sorsolasok:${guildId}:${sorsolas_id}`, `sorsolasok:${guildId}:${sorsolas_id}:participants`]);
					}
				}
			}, 60000)

			console.log(`Logged in as ${this.user!.tag}`)
			if (process.env.REGISTER_COMMANDS_AT_STARTUP == "1") {
				this.registerCommands();
			}
		});

		this.on(Events.GuildMemberAdd, async (member) => {
			const welcomemsg = await this.db.get(`welcome-message:${member.guild.id}`);
			if (!member.user.bot && welcomemsg) {
				if (!member.dmChannel) await member.createDM();
				if (member.dmChannel) member.dmChannel.send(welcomemsg);
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