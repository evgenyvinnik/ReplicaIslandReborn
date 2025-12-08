/**
 * String resources for Replica Island Reborn
 * Ported from: Original/res/values/strings.xml, wanda.xml, kyle.xml, kabocha.xml, rokudou.xml
 */

// Character names
export const CharacterNames = {
  Wanda: 'Wanda',
  Kyle: 'Kyle',
  Kabocha: 'Dr. Kabochanomizu',
  Rokudou: 'Mr. Rokudou',
  Android: 'Android',
} as const;

// Level names
export const LevelNames: Record<string, string> = {
  'level_0_1_sewer': 'Memory #000',
  'level_0_2_lab': 'Memory #001',
  'level_0_3_lab': 'Memory #002',
  'level_1_1_island': 'Memory #003',
  'level_1_2_island': 'Memory #004',
  'level_1_3_island': 'Memory #005',
  'level_1_4_island': 'Memory #006',
  'level_1_5_island': 'Memory #007',
  'level_1_6_island': 'Memory #008',
  'level_1_7_island': 'Memory #009',
  'level_1_8_island': 'Memory #010',
  'level_1_9_island': 'Memory #011',
  'level_2_1_grass': 'Memory #012',
  'level_2_2_grass': 'Memory #013',
  'level_2_3_grass': 'Memory #014',
  'level_2_4_grass': 'Memory #015',
  'level_2_5_grass': 'Memory #016',
  'level_2_6_grass': 'Memory #017',
  'level_2_7_grass': 'Memory #018',
  'level_2_8_grass': 'Memory #019',
  'level_2_9_grass': 'Memory #020',
  'level_3_1_sewer': 'Memory #021',
  'level_3_2_sewer': 'Memory #022',
  'level_3_3_sewer': 'Memory #023',
  'level_3_4_sewer': 'Memory #024',
  'level_0_1_sewer_kyle': 'Memory #024.3',
  'level_0_1_sewer_wanda': 'Memory #024.7',
  'level_3_5_sewer': 'Memory #025',
  'level_3_6_sewer': 'Memory #026',
  'level_3_7_sewer': 'Memory #027',
  'level_3_8_sewer': 'Memory #028',
  'level_3_9_sewer': 'Memory #029',
  'level_3_10_sewer': 'Memory #030',
  'level_3_11_sewer': 'Memory #030.5',
  'level_4_1_underground': 'Memory #031',
  'level_4_2_underground': 'Memory #032',
  'level_4_3_underground': 'Memory #033',
  'level_4_4_underground': 'Memory #034',
  'level_4_5_underground': 'Memory #035',
  'level_4_6_underground': 'Memory #036',
  'level_4_7_underground': 'Memory #037',
  'level_4_8_underground': 'Memory #038',
  'level_4_9_underground': 'Memory #039',
  'level_final_boss_lab': 'Memory #040',
};

// UI Strings
export const UIStrings = {
  game_over: 'GAME OVER',
  thanks_for_playing: 'THANKS FOR PLAYING!',
  please_wait: 'PLEASE WAIT',
  memory_playback_start: 'MEMORY PLAYBACK START',
  memory_playback_complete: 'MEMORY PLAYBACK COMPLETE',
  diary_found: 'FOUND OLD DIARY',
  // Preferences - Category headers
  preference_game_settings: 'Game Settings',
  preference_save_game: 'Game Data',
  preference_about: 'About',
  // Preferences - Sound
  preference_enable_sound: 'Enable Sound',
  preference_enable_sound_summary: 'Disabling sound may improve performance on some devices.',
  // Preferences - Controls
  preference_configure_controls: 'Configure Controls',
  preference_enable_click_attack: 'Click Attack',
  preference_enable_click_attack_summary: 'Use the trackball click or directional pad center button to attack.',
  preference_enable_screen_controls: 'On-Screen Controls',
  preference_enable_screen_controls_summary: 'Displays movement pad and buttons on screen. Suggested for devices without a d-pad or trackball. Requires multitouch.',
  preference_movement_sensitivity: 'Motion Sensitivity',
  preference_movement_sensitivity_summary: 'Adjusts the sensitivity of the trackball, d-pad, or optical sensor.',
  preference_movement_min: 'Slow',
  preference_movement_max: 'Fast',
  preference_key_config: 'Configure Keyboard',
  preference_key_config_summary: 'Customize keys for phones with hard keyboards.',
  preference_key_config_dialog_title: 'Configure Keyboard',
  preference_key_config_dialog_ok: 'Save',
  preference_key_config_dialog_cancel: 'Cancel',
  preference_key_config_left: 'Left',
  preference_key_config_right: 'Right',
  preference_key_config_jump: 'Jump',
  preference_key_config_attack: 'Attack',
  // Preferences - Save data
  preference_erase_save_game: 'Erase Saved Game',
  preference_erase_save_game_dialog: 'Really erase your saved game?  All of your progress will be lost!',
  preference_erase_save_game_dialog_title: 'Now wait just a minute',
  preference_erase_save_game_dialog_ok: 'Erase Save',
  preference_erase_save_game_dialog_cancel: 'Cancel',
  saved_game_erased_notification: 'Save data erased.',
  // Preferences - About section
  preference_visit_site: 'Go to the Replica Island web site',
  preference_misc: 'More Information',
  preference_about_title: 'About Replica Island',
  preference_about_summary: 'Replica Island was made by Chris Pruett and Genki Mine, and produced by Tom Moss.',
  preference_thanks_title: 'Special Thanks',
  preference_thanks_summary: 'Special Thanks to Eido Inoue, Casey Richardson, Jason Chen, Tim Mansfield, and the Android Team for their support of this project.',
  preference_licence_title: 'License',
  preference_licence_summary: 'Portions of this game are modifications based on work created and shared by Google and used according to terms described in the Creative Commons 3.0 Attribution License.',
  // Web port credits
  preference_web_port_title: 'Web Port',
  preference_web_port_summary: 'This web version was ported using React, TypeScript, and HTML5 Canvas.',
  // Difficulty
  baby_description: 'No challenge at all.',
  kids_description: 'A comfortable ride to the end.',
  adults_description: 'True accomplishment requires hardship.',
  // Quit dialog
  quit_game_dialog_title: 'Quit Game?',
  quit_game_dialog_ok: 'Quit',
  quit_game_dialog_cancel: 'Cancel',
  quit_game_dialog_message: 'Return to main menu?',
  // Game results
  game_results_title: 'GAME RESULTS',
  game_results_pearls_collected: 'PEARLS COLLECTED:',
  game_results_robots_destroyed: 'ROBOTS DESTROYED:',
  game_results_total_play_time: 'TOTAL PLAY TIME:',
  game_results_ending: 'ENDING ACHIEVED:',
  game_results_kabocha_ending: 'BAD ENDING #1 - Kabocha Wins',
  game_results_rokudou_ending: 'BAD ENDING #2 - Rokudou Wins',
  game_results_wanda_ending: 'GOOD ENDING - World Saved!',
} as const;

// Wanda's dialog strings
export const WandaDialogs: Record<string, string> = {
  // Level 0-1
  'Wanda_0_1_1_1': 'Oh no!',
  'Wanda_0_1_1_2': "Looks like he landed OK but his memory array is all smashed. Kyle has really crossed the line this time!",
  'Wanda_0_1_1_3': "Hmm, his self-repair mechanism is still intact. If I can just reconnect the power...",
  
  // Level 3-5
  'Wanda_3_5_1_1': "Are you feeling better Mr. Android? Your memory is probably still scrambled, but don't worry--it will return with time as your repair system brings the backup content out of storage. Frankly, I think it's amazing that you're still moving around after taking such a powerful hit.",
  'Wanda_3_5_1_2': "When your memories come back online you should access them to remind yourself what you've been up to until now. The repair system is going to take a while to decompress all your previous memories, so they might not come on line in chronological order. They'll all return eventually though.",
  'Wanda_3_5_1_3': "Stay away from Kyle if you see him. He messed you up pretty bad before and I think he's likely to do it again. He's such an idiot sometimes.",

  // Level 1-1
  'Wanda_1_1_1_1': "Why hello there! You're not another one of this island's crazy creations, are you? Let me guess: you must be the handiwork of Dr. Kabochanomizu. We're supposed to be on opposing teams but I personally don't see what all the fuss is about. If we find it first then it's ours, if you find it first then it's yours.",
  'Wanda_1_1_1_2': "Oh, I'm Wanda, by the way. Nice to meet you. Can I call you Mr. Robot? Nah, that sounds like a line from an '80s song. How about Mr. Android? That's better. It's so nice to make your acquaintance, Mr. Android.",
  'Wanda_1_1_1_3': "Good luck finding The Source. My team is looking for it too, but so far no luck. Enjoy the island, but watch out: it's pretty weird in some parts.",

  // Level 3-7
  'Wanda_3_7_1_1': "Hey there, Mr. Android, looks like you're recovering pretty quickly! Have you remembered my name yet?",
  'Wanda_3_7_1_2': "This sewer is the pits, huh? I mean, how can there even be a sewer here? It's not like there are any buildings to connect it to. The things that are here, they all grew here, I guess. Mr. Rokudou says it's just The Source doing what it does, but it gives me the creeps. I think there's another, older structure even deeper underground, but we haven't found an entrance yet. I almost hope we don't.",
  'Wanda_3_7_1_3': "Oh, by the way, Kyle's still on the warpath and he found out you're still operative. You might want to watch your back.",

  // Level 1-5
  'Wanda_1_5_1_1': "We meet again, Mr. Android! How's your search going? We've almost finished our scan of the beach, but I'm not supposed to tell you about it. Mr. Rokudou and Dr. Kabochanomizu don't think too highly of each other, I gather, so technically you're a business rival. Don't worry though, I like you.",
  'Wanda_1_5_1_2': "Mr. Rokudou is a pretty amazing guy. I mean, he's like the head of this giant corporation and he sort of sounds like a robot when he talks (no offense!), but he's put all this energy into finding The Source so he can rid the world of disease, hunger, and war. That's such a noble aspiration, particularly for a businessman, don't you think?",
  'Wanda_1_5_1_3': "Kyle and I are the most recent search team, but Mr. Rokudou has been sending people here for years. I'm sure we'll be the ones who finally find The Source.",
  'Wanda_1_5_1_4': "Unless, of course, you find it first!",

  // Level 3-11
  'Wanda_3_11_1_1': "No, you two, stop! There's no need to fight about this!",
  'Wanda_3_11_2_1': "No!",

  // Level 4-1
  'Wanda_4_1_1_1': "Get out of my sight. You rotten, murdering, good for nothing bucket of bolts. I never want to see you again. I will never forgive you for what you did to Kyle.",

  // Level 1-6
  'Wanda_1_6_1_1': "My partner, Kyle, is around here somewhere. You'll probably run into him. I should warn you though, he's kind of full of himself. And he's really competitive--this isn't just a job to him, it's like a test of his manhood or something.",
  'Wanda_1_6_1_2': "But once you get to know him, he's a pretty nice guy. Just don't get on his bad side.",

  // Level 4-2
  'Wanda_4_2_1_1': "Did you even think about what you were doing? Did you even consider that maybe, just maybe, there was some other way to resolve the situation? Or do you just calculate the shortest possible path to your objective and then iterate until it's complete? Just follow the rules by rote, never considering whether or not your way is the best way?",
  'Wanda_4_2_1_2': "Kyle was my friend, but to you he was just an obstacle to overcome. You probably didn't even think of him as a person, just another in a long line of hurdles on the way to the finish line. I can't believe I trusted a machine.",

  // Level 2-6
  'Wanda_2_6_1_1': "Hey Mr. Android, are you stuck? Here, I'll clear a path for you.",
  'Wanda_2_6_2_1': "Mr. Rokudou told us that this whole island, every little bit of it, is something that The Source manufactured. The eggheads don't know why it makes stuff, or how it chooses to grow the things it does, but they think it has something to do with influences from outside sources. Mr. Rokudou calls it \"proximity influence remanifestation,\" whatever that means.",
  'Wanda_2_6_2_2': "Anyway, nobody knows exactly where The Source comes from, but it hasn't been here for very long. This island is less than two hundred years old, and people have been visiting it for at least the last fifty. I've seen evidence of early explorers--old diaries and stuff. But nobody knows what The Source is doing, or who made it, or why it's sitting out here in the middle of the ocean, growing this weirdo island.",
  'Wanda_2_6_2_3': "Personally, my money is on the space theory. I bet it's some sort of alien artifact that crash-landed here a long time ago.",

  // Level 4-5
  'Wanda_4_5_1_1': "Look, Android, I know you're in a rough spot. Kabocha has lost it, and now he has The Source, so somebody has to stop him. I can see you're are trying to do that.",
  'Wanda_4_5_1_2': "But that doesn't make up for what you did to Kyle. Maybe you didn't know what you were doing. Or maybe Kabocha manipulated you into thinking it was the right thing to do. I don't know. But I will never trust you again.",
  'Wanda_4_5_1_3': "Let me just say this. I don't trust Rokudou either. He could have saved Kyle but for some reason he didn't. I'm starting to think he's not the man I thought he was. I know he's helping you out now but I'd watch my back if I were in your shoes.",

  // Level 3-3
  'Wanda_3_3_1_1': "So you met Kyle, huh? I told you he can be a bit of a jerk, right? He and I grew up together, and he's always been kind of arrogant, but getting this assignment from Mr. Rokudou really pumped up his ego. He's actually a really nice guy under those dark glasses. Last year he wrote me a song for my birthday, if you can believe that.",
  'Wanda_3_3_1_2': "Kyle also got me this job. I have to admit, I was pretty hesitant to go to work for a giant company like Rokudou Corp. at first.",
  'Wanda_3_3_1_3': "But Mr. Rokudou's different. I met him and even though he refuses to take off that weird mask (is it zits? uncontrollable facial hair? maybe a scar?) I am convinced that he's really trying to make the world a better place.",

  // Level 4-7
  'Wanda_4_7_1_1': "Android. I wanted to tell you about the latest information I have on Rokudou. I hacked the corporate network and had a look at Rokudou's sensitive files. There's still a lot I don't have access to, but what I've seen is enough.",
  'Wanda_4_7_1_2': "He's a criminal mastermind. The whole businessman-with-a-heart-of-gold shtick is just for show. Secretly he's built Rokudou Corp. by investing in all sorts of illegal black markets. His main source of income seems to come from stripping natural resources from impoverished and war-torn nations.",
  'Wanda_4_7_1_3': "I can't imagine what he'll do if he gets his hands on The Source. He may actually believe he can use it to make the world a better place, but surely it will only be a better place for him--the rest of us will suffer.",
  'Wanda_4_7_1_4': "I know Kabocha is completely unstable and you're trying to stop him by helping Rokudou, but either way I think the world as we know it is going to end. What should we do?",

  // Level 1-9
  'Wanda_1_9_1_1': "I guess we're actually pretty lucky nobody has found The Source so far. I mean, in the wrong hands it could probably be used as a powerful weapon. Mr. Rokudou once said that with The Source you could grow an army that would cover the earth. It's a good thing he's planning on using it to reduce green house gases and repopulate endangered species instead! I'm sure Dr. Kabochanomizu has a similar goal, right?",

  // Level 2-9
  'Wanda_2_9_1_1': "Despite all of the weird bugs and stuff here, I actually kind of like this island. It's like a theme park: just weird enough to be fun but just normal enough to pass as natural. Kyle was telling me if we find The Source, we'll be able to control it and make it grow whatever we want.",
  'Wanda_2_9_1_2': "But a part of me doesn't want to find it; I kind of like how this island has grown this way on its own, without some person directing its focus. Like, it doesn't need to be manipulated to create something beautiful.",

  // Level 4-9
  'Wanda_4_9_1_1': "Android. You have to make a choice. If you don't stop Kabocha, he's going to transform life on this planet in ways that can't possibly be good. But if you help Rokudou, the world will be forced to succumb to his will. This is a lose-lose situation.",
  'Wanda_4_9_1_2': "You're just a tool to these guys--they have their own personal vendettas and they are just using you as a means to an end. There must be something else you can do to prevent either of them from getting their hands on The Source.",
  'Wanda_4_9_1_3': "Look, I was wrong about you before. I know what happened to Kyle wasn't your fault alone. I know you're trying to do the right thing. But neither Rokudou nor Kabocha is fit to wield the power of The Source. You need to make a choice, Android, and you need to make it very carefully.",
};

// Kyle's dialog strings
export const KyleDialogs: Record<string, string> = {
  // Level 2-1
  'Kyle_2_1_1_1': "Well, well, what have we here? Some kind of robot? Looks like Kabocha's work. Hmph. First the maniac releases those annoying blue robots and now this? He's too scared to venture out of his little fortified bunker so he makes these hunks of junk do his dirty work for him. What a coward.",
  'Kyle_2_1_1_2': "Hey! Hey you! Can you even talk? Hmph, figures. What a joke. Kabocha's \"inventions\" are truly pathetic. It's no wonder he hasn't found The Source in 50 years--the man sets a new bar for incompetence.",
  'Kyle_2_1_1_3': "Tell you what, grease ball. You stay out of my way and I might not send your shiny green posterior into outer orbit. My name's Kyle, and I am the best of the best. One false move and I'll hit you so hard your code will run in reverse.",

  // Level 3-8
  'Kyle_3_8_1_1': "Didn't think I'd be seeing you again. Can't you take a hint, you bumbling bundle of bolts? I was right about you--you're a little Kabocha spy, aren't you.",
  'Kyle_3_8_1_2': "Look, last time I didn't really put my heart into it. I pulled my punches because frankly, I didn't think it would take a full-strength hit to bring you down. It's surprising that you survived, but even more inconceivable that you didn't just turn around and go home. You're just asking to be flattened, aren't you.",
  'Kyle_3_8_1_3': "Hmph. Tell you what, I'll give you a chance to prove you're worth more than scrap metal. Race me to the next gem. If you get it first, I'll let you off easy. If I get there first, I'm going to reduce you to a smoldering crater. No pulling punches this time.",
  'Kyle_3_8_2_1': "Not bad for amateur hour. I was going to go ahead and obliterate you anyway, but on second thought a deal is a deal. I guess I'll let you stumble about for a while longer before I reduce you to your principal elements. More fun that way.",

  // Level 2-3
  'Kyle_2_3_1_1': "You know what your problem is? You can't think. You can't reason. You can't decide. All you can do is execute your little program, follow the breadcrumbs Kabocha has left for you. Your brain is a routine: just stimulus, response, stimulus, response. Every possible thought you could ever have has been predetermined.",
  'Kyle_2_3_1_2': "Which is why you're never going to get anywhere on this island. This place is the very antithesis of determinism. It's random, crazy. The Source doesn't just copy things it's touched, it combines them, mutates them, twists them. There's no consistency, no pattern, no algorithm. It just is.",
  'Kyle_2_3_1_3': "You're screwed. Mr. Rokudou sends people like Wanda and me to search for The Source because he knows no machine could ever survive for long on this island. We can make split-second decisions, alter our perspectives, deal with problems we've never seen before. All the logic boards, solid state memory, and neural networks in the world can't help you do that. You've lost before you even started.",

  // Level 3-9
  'Kyle_3_9_1_1': "You never learn, do you? It's pointless. You cannot beat Mr. Rokudou. He has infinite resources--even the puny little array of logic gates you call a brain should be able to understand that. Face it, Kabocha is a has-been and you don't stand a chance down here. I should just smash your central processor now and put you out of your misery.",
  'Kyle_3_9_1_2': "Stay out of my way. If I see you again I swear I am going to turn you inside out and set fire to your internals.",

  // Level 3-4
  'Kyle_3_4_1_1': "You followed us down here, didn't you? You slimy, spying little bucket of transistors. We do all the work and you just tag along, is that how it is? Mr. Rokudou takes all the risk and Kabocha just rides on his coattails, all the way to The Source? You're even more pathetic than I thought.",
  'Kyle_3_4_1_2': "Look, I've had about enough of you and your little punk tricks. If Kabocha wants The Source he's going to have to come down here and get it himself. No stupid little robot is going to stand in my way.",

  // Level 3-10
  'Kyle_3_10_1_1': "I warned you, you over-complicated washing machine. I told you not to cross my path again, and yet here you are. That's it, I'm done wasting my time with this crap.",

  // Level 2-4
  'Kyle_2_4_1_1': "Still kicking, huh? I guess Kabocha really went all out on your design--you're a lot more sophisticated than his earlier attempts. He's a lunatic, you know. Mr. Rokudou says that he lost it years ago. Kabocha is obsessed with this delusional idea that Rokudou Corp. somehow snubbed him way back in the day. It's all fiction, of course; he's been here so long The Source has probably taken its toll on his psyche. Still, you're proof that at least part of his senile brain is still operating.",
  'Kyle_2_4_1_2': "Don't get too comfortable, though. I meant what I said before: you get in our way and I'll take you apart. We're here to find The Source for Mr. Rokudou, and we're not going to fail.",

  // Level 2-5
  'Kyle_2_5_1_1': "Look, sorry if I was a little harsh with you back there. I don't trust Kabocha and I don't trust robots. Still, you seem pretty innocent. Does Kabocha really force you to collect pearls to keep operating? I told you he was crazy.",
  'Kyle_2_5_1_2': "Anyway, tell you what. You stay out of my way and I'll try to keep my cool, alright? You make me nervous and I tend to lash out when I'm nervous. I punched a teacher once for making me stand up in front of the class, you know? It's not my favorite personality trait, but when my blood gets going there's not much I can do to cool down. It's probably best if you just avoid me. We're going to find The Source first anyway, ha!",

  // Level 2-7
  'Kyle_2_7_1_1': "Mr. Rokudou is a genius, you know? He built Rokudou Corp. from the ground up to find and capture The Source. He's sent teams here periodically since the '50s. They all failed, of course, but as technology has improved some of them actually made it back alive.",
  'Kyle_2_7_1_2': "And in the mean time Mr. Rokudou spread out into charity, fast food chains, and even expensive wine. Rokudou Corp. is now one of the world's top multinational corporations.",
  'Kyle_2_7_1_3': "Of course, finding The Source once and for all will cement his position as the single most powerful man in the world. He's a man with brains and morals, someone we can trust. That's why we have to find The Source before some lunatic like Kabocha does. For all we know he wants to start the next world war.",

  // Level 2-8
  'Kyle_2_8_1_1': "You're lucky you caught up to me when I'm in a good mood. Five minutes ago I would have cracked open your top and spit on your insides, but right now I've got more important things to think about. Wanda just told me we've found the entrance.",
};

// Kabocha's dialog strings
export const KabochaDialogs: Record<string, string> = {
  // Level 0-2
  'Kabocha_0_2_1_1': "System check looks good, unit tests are passing, bootstrap is complete! Oh jolly, he's responding!",
  'Kabocha_0_2_1_2': "Hello there, Android. I'm Dr. Woodrow Lichtenstein Kabochanomizu, your humble creator. You're going to help me find something very precious that I've been studying for most of my life: The Source.",
  'Kabocha_0_2_1_3': "But first, we should go over some of the basics. Use the trackball or directional pad to roll left and right. You only need to make very small movements to move effectively. Try rolling down that hill.",
  'Kabocha_0_2_2_1': "Jolly good! You learn exactly as quickly as I calculated you would. Fantastique! Remember, the trackball and directional pad are just for changing direction. You do not need to press them constantly.",
  'Kabocha_0_2_2_2': "Now, rolling around is a pleasurable way to move, but to really travel in style you should fly. Tap the blue button on the bottom of the screen to jump, and hold it down to fly. Be careful though--your batteries can only hold you aloft for a short time before they need to recharge. Watch the meter at the top left of the screen to see your remaining flight power.",
  'Kabocha_0_2_2_3': "Try flying up this shaft.",
  'Kabocha_0_2_3_1': "Bravo! Fantastique! It's a little scary at first, yes? Don't worry, you'll get the hang of it. The trick is to just make small movements left and right while in the air.",
  'Kabocha_0_2_3_2': "Now my friend, let us give you a more complicated test. I had my robots turn this part of the lab into something of an obstacle course. Let's see if you can make it to the other side. I'll be waiting for you there.",
  'Kabocha_0_2_4_1': "Excellent work, and in record time too! My calculations are once again correct: you are the most capable machine I have ever developed. You surely will find The Source where all others have failed.",
  'Kabocha_0_2_4_2': "Did you see those little pearls floating in the air along the way? You should collect them as you travel across the island. If you are damaged, collecting pearls will help your repair system and give you an impressive energy shield for a short time. The pearls do not actually have anything to do with your operation but I really need them to help pay off this lab. The economy, you know.",
  'Kabocha_0_2_4_3': "Jolly good. Let's move on. Push the red button on the ground over there to open the door with the red mark.",
  'Kabocha_0_2_5_1': "This entire island flows from The Source. Its power affects the things that get close to it, and this island is consequently full of unique forms of life. One of them, I'm sorry to say, is my fault.",
  'Kabocha_0_2_5_2': "Years ago I released some small robots on the island in an attempt to pinpoint the exact location of The Source. The mistake I made was allowing them to replicate on their own. The Source twisted them such that I lost control, and since then they have multiplied at such a rate that the little pests have almost overrun the island.",
  'Kabocha_0_2_5_3': "I've given you a useful maneuver to dispose of these pesky troublemakers. While in the air, press the red attack button to drop your full weight onto enemies and crush them. Give it a shot on that fellow to the left.",
  'Kabocha_0_2_6_1': "Jolly good! Way to drop the hammer! (My calculations suggest that phrase is the preferred selection given the state of contemporary language) Of course, you can always just avoid these robotic cretins if you like, but you'll be doing the island a great service if you destroy them. Remember, if you get hurt you can collect pearls to restore your health and help me put a dent in my credit card bill.",
  'Kabocha_0_2_6_2': "One more important point I almost forgot to mention. Your internal battery uses red gems to synthesize power from extremely low-light conditions. I did a survey of the island and concluded that every major area has enough gems to keep you going, but it is imperative that you collect them whenever you see them. My research suggests that there should be at least three gems in each area, and to get to the next area you must collect all three.",
  'Kabocha_0_2_6_3': "Ho ho, we can't be sending you off into the wild without knowing things like that, can we? Right-o, ahead is an area with three gems. Find them and we can move on to more complicated topics, like what you're doing here and how The Source is going to help me save the world.",

  // Level 0-3
  'Kabocha_0_3_1_1': "Jolly ho, my little creation! You are almost ready to venture out by yourself. I need to tell you about your mission, which is of critical importance to the future of this planet. But before that, let me show you a trick.",
  'Kabocha_0_3_1_2': "First, make your way through this maze. Make sure you pick up the red gem on the way.",
  'Kabocha_0_3_2_1': "I've outfitted you with a special type of energy weapon that allows you to control machines. While standing on the ground, hold down the attack button for a few seconds to charge up the Possession Orb.",
  'Kabocha_0_3_2_2': "Once the Possession Orb is released, you can control its movement by tilting the phone. Running it into a mechanical object will allow you to possess that object. Pressing the attack button will destroy it and return control to your body.",
  'Kabocha_0_3_2_3': "Try possessing that robot down there and using him to break through those blue blocks. Here's a hint: releasing a possessed robot causes it to explode.",
  'Kabocha_0_3_3_1': "Jolly good work! You're already asymptotically equal to my best neural net model.",
  'Kabocha_0_3_3_2': "One more thing about possession: those energy orbs require a lot of power to maintain, so you can only use them for a short time if you have not collected any gems. Collecting gems will extend the amount of time the orb can survive before dissipating.",

  // Level 4-3 (Kabocha reveals his true intentions)
  'Kabocha_4_3_1_1': "Jolly good work, my little friend! The Source is within my grasp after all these years!",
  'Kabocha_4_3_1_2': "Ha ha ha ha ha ha ha ha ha ha ha ha ha ha! My time has finally come. Rokudou, you shall cower at my feet! If you lick my boots well enough I may find it in my heart to kill you quickly. I was thinking of slowly replacing your bone marrow with molten lead, but that might not be painful enough.",
  'Kabocha_4_3_1_3': "Oh, jolly day! Finally, after all my research, my blood and sweat and tears, finally The Source is mine. Nobody shall stand in my way now! Ho ha ha ha ha ha he ha ha ha ho ha he ha ho he ha ha he he ho ho ha he ho ha ha!",
  'Kabocha_4_3_1_4': "(Ahem) As for you, my little green friend, you've reached the end of your usefulness. As your creator, I thank you for your service. I really should shut you down properly, but right now The Source and I have more important matters to attend to back at the lab. Tell you what: your final command is to rot down here in this cave. See to it that you follow it to the letter. Ta-ta!",

  // Final Boss (Kabocha vs Rokudou)
  'Kabocha_final_boss_1_1': "Don't waste your breath, Rokudou. This little robot is MY creation, and he does MY bidding.",
  'Kabocha_final_boss_1_2': "I underestimated you, my little friend. Your capabilities have far surpassed even my most optimistic projections. Still, you are hardwired to follow my command. And besides, Rokudou is a soulless monster. What makes you think you can trust him?",
  'Kabocha_final_boss_1_3': "Now, do me a favor and go knock his head in. A few well-placed stomps should do the trick. Jolly ho!",
};

// Rokudou's dialog strings
export const RokudouDialogs: Record<string, string> = {
  // Level 3-9
  'Rokudou_3_9_1_1': "Hello there, Android. My name is Rokudou.",
  'Rokudou_3_9_1_2': "Ever get the feeling that you are on the wrong team, Android? Ever wonder if maybe Kabochanomizu isn't exactly the man he portrays himself to be?",
  'Rokudou_3_9_1_3': "You are an amazing machine. Your talents are wasted on a washed-up researcher like Kabocha. You should join my team.",
  'Rokudou_3_9_1_4': "I can see that you are hesitant. Not surprising; I am sure Kabocha did his best to convince you that he's a kind-hearted scientist, acting for the greater good of the world. Make no mistake, Android. Kabocha is a lunatic--he must not gain access to The Source.",
  'Rokudou_3_9_1_5': "Join my team, Android. Help us find The Source and change the world. Take some time to think it over. I am a patient man.",

  // Level 4-1
  'Rokudou_4_1_1_1': "Do not trouble yourself over Kyle, Android. He was a good agent but he let his success go to his head. In the final analysis, his arrogance was his biggest weakness. You, on the other hand, displayed cunning and resourcefulness. Good show!",
  'Rokudou_4_1_1_2': "The Source has a way of affecting people. Other teams I sent to this island in the past have vanished without a trace. The few that made it back returned with fatal health problems. That's why an inorganic like you is so perfect for this job. Make no mistake, The Source is a natural occurrence--nature's next logical step. I theorize that it may actually be a tiny piece of a larger whole, a body that created the entire universe! But there will be plenty of time for academics once we have obtained The Source; for now we must concentrate on finding it.",
  'Rokudou_4_1_1_3': "Have you considered my offer, Android? It still stands. Join my team; help me find The Source and save the world from maniacs like Kabocha.",

  // Level 4-4
  'Rokudou_4_4_1_1': "Android. The time for pleasantries has ended. Kabocha has The Source, and it will not be long until he learns how to channel its power. We must move quickly if we are to stop him. You are our only hope now.",

  // Level 4-7
  'Rokudou_4_7_1_1': "My sensors indicate a large disturbance field not far from here. That must be the location of Kabocha's secret lab. He's surely shielded it, which means the readings I am picking up are actually a tiny fraction of the power he is generating. It must be The Source! We must move quickly if we are to stop him and his insane scheme.",
  'Rokudou_4_7_1_2': "Keep moving, Android. The fate of the world approaches.",

  // Final Boss
  'Rokudou_final_boss_1_1': "Excellent work, Android. You have penetrated Kabocha's secret laboratory. The Source is within our grasp!",
  'Rokudou_final_boss_1_2': "Quickly now, put Kabocha out of his misery. He may be old and frail, but as long as he lives The Source is in jeopardy.",
  'Rokudou_final_boss_1_3': "Android, stop wasting time! Destroy Kabocha and we shall rule the Earth!",
};

// Combined string lookup function
export function getString(key: string): string {
  // Check all dialog sources
  if (key in WandaDialogs) return WandaDialogs[key];
  if (key in KyleDialogs) return KyleDialogs[key];
  if (key in KabochaDialogs) return KabochaDialogs[key];
  if (key in RokudouDialogs) return RokudouDialogs[key];
  if (key in LevelNames) return LevelNames[key];
  if (key in UIStrings) return UIStrings[key as keyof typeof UIStrings];
  
  // Return the key itself if not found
  console.log(`String not found: ${key}`);
  return key;
}
