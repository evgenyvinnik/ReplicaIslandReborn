/**
 * Diary Entries - Story content found throughout the game
 * Ported from: Original/res/values/strings.xml (Diary1-15)
 * 
 * These diary entries tell the backstory of Dr. Kabochanomizu and his
 * descent into madness while searching for The Source on the island.
 */

export interface DiaryEntry {
  id: number;
  title: string;
  text: string;
}

export const DiaryEntries: DiaryEntry[] = [
  {
    id: 1,
    title: "Log Entry - Thursday - Sunny",
    text: `I have arrived! I borrowed a dinghy from the freighter and rowed to shore as the ship passed by the island early this morning. The captain has promised to return for me in two weeks; more than enough time to complete my mission.

I find myself standing in the middle of a vast beach, with sand dunes stretching great distances down the coastline and the green of tropical forest visible near the horizon. An uninformed man would think this place a paradise. I know better. Still, I cannot help but marvel at the island's wholly unnatural beauty.`
  },
  {
    id: 2,
    title: "Log Entry - Sunday - Sunny",
    text: `Before leaving the mainland I met with Mr. Rokudou about my mission. He is a great man, the type of man who might actually effect change rather than just talk about it. I was happy to see that he recognized my rather unique skills. I am neither a survivalist nor an outdoorsman; I cannot even remember the last time I went camping. It was very shrewd of Mr. Rokudou to select me as the right person to visit this odd, deserted island. I shall not let him down.`
  },
  {
    id: 3,
    title: "Log Entry - ??? - Dark",
    text: `Analysis of slime-like creature. Resembles an arthropod except instead of protective armor the beast seems to be covered in a soft, sticky substance resembling tar. Suspect genetic similarities to Holothuroidea, but the island's influence has twisted the result into a dangerous menace. I ate a piece of the specimen and gagged.

I never should have come here. Rokudou tricked me into this, and now I cannot even find my way back to the surface. The freighter has surely long since come and gone; my sense of time is quickly losing its clarity but I am sure that more than two weeks have passed since I arrived in this hellish place. I never should have come here.`
  },
  {
    id: 4,
    title: "Log Entry - Monday - Overcast",
    text: `I met a group of three adventurers today. I thought that I had the island all to myself, and I was so surprised to hear human voices (with Brooklyn accents, no less!) outside my shelter that I knocked over a bamboo support and almost brought the roof down. The group is independent but they are after The Source, just like me. They were nice but I sensed a little bit of competitive tension in the air. They have been here for a month already and have barely penetrated the forest beyond the beach. I am glad to have met them but they pose no immediate threat to my mission. They are fine folks but my skills are far superior.`
  },
  {
    id: 5,
    title: "Log Entry - Saturday - Rain",
    text: `Today marks three consecutive days of rain. Last week was clear--the seas were calm and my carefully constructed shelter proved unnecessary. I am sitting in a small alcove at the base of a hollow tree as the sky dumps golf ball-sized raindrops into the forest around me. The beach is long behind me now and the sound of the ocean is just a memory.

This is a weird place. The oddities increase as I move closer to the center. Since entering the forest I have seen a few things I cannot explain. No matter, my mission is clear and success is guaranteed. I will sleep here tonight and then venture further towards the island's center tomorrow.`
  },
  {
    id: 6,
    title: "Log Entry - ??? - Damp",
    text: `What in the world is a sewer system doing under a tropical island anyway? The island has grown it to resemble the architecture of some old European city, but for what purpose? What little tidbit of inspiration caused this vast underground structure to manifest? Perhaps a photograph, or a child's picture book. The island itself is too far from any country with this sort of architecture for the influence to be direct.

When I get out of here I am going to find Rokudou and educate him in the error of his ways. The Source is getting closer, but I am not sure I want to find it anymore.`
  },
  {
    id: 7,
    title: "???",
    text: `There is no rain underground!

Rain, rain, go away, come again some other day.

All the king's horses and all the king's men couldn't put Humpty together again.`
  },
  {
    id: 8,
    title: "Log Entry - Wednesday - Overcast",
    text: `I may have found a path into the forest. The grasslands stretch out ahead in what appears to be a small glade, but I think that beyond them the border of the forest will thin. If my calculations are correct, this side of the island should be shady most of the year, so I expect that the almost impenetrable forest vegetation will yield enough to permit traversal.

The adventuring party I met a few days ago has been here a month and has not yet figured this out. My intellect is truly superior--I can understand why Mr. Rokudou chose me for this mission. Once I find The Source and show him how to use it, he will surely make me his second-in-command, a position from which I shall have incredible influence. Just thinking about it makes me giddy. But I must not to get ahead of myself; the forest looms.`
  },
  {
    id: 9,
    title: "???",
    text: `Skin skin skin skin skin skin skin skin skin skin skin.

There's not enough skin on those pirates!`
  },
  {
    id: 10,
    title: "Log Entry - Monday (?) - Rain",
    text: `My progress has been arrested by the insane creatures that inhabit this island. Some of them are so normal they might have migrated here after the island was formed. But the rest are clearly products of The Source running unchecked; they do not bear even the slightest resemblance to the children of Mother Nature. This island is a facsimile, a replica of bits and pieces of the world, twisted and grown from nothing, sprouting in every direction. It is power in its purest form, writhing in the sea without tether.

But with a guiding hand, that power could be put to such great use! With The Source in our hands mankind could shape the world as we see fit; it would mean a true end to war and poverty. Rokudou wants that power--I want that power--so the world can be freed from governments and other parasites that seek only to oppress and destroy. Glory is almost within my grasp.`
  },
  {
    id: 11,
    title: "Log Entry - I've lost track of the date - Heavy Rain",
    text: `The adventurers I met are dead. I found them hanging from the trees near a rock formation in the forest. The discovery was startling and sad; though we were both competing for the same goal I felt a certain camaraderie with them. They were, of course, the only other humans on the island.

Though tragic, I cannot let their unfortunate end distract me from my goal. The rock formation near the bodies is an important find; it appears to be the mouth of some sort of cave. However, most exciting is that the rock itself looks as if it has been cut by man; I dare say that it resembles an entrance to a subway station or bunker.

I will venture into the forest once more before entering the cave. At the adventurers' base camp I spied batteries and other useful electronic equipment, which I can surely modify. Once I have procured those items I shall return and make my descent.`
  },
  {
    id: 12,
    title: "Log Entry - Unknown - Underground",
    text: `My head hurts. Maybe it is the fumes down here; I feel like my head is filling up with pressure and soon it will burst. When the pain gets bad I sit down and focus on counting primes, an old childhood relaxation habit that has resurfaced here under the ground.

When I find The Source, I am going to use it to cure myself of whatever it is that has taken hold of me. If Rokudou complains then maybe I'll just eject him from the planet. After all, he's not the one down here in this false sewer, with scraped knees and a pounding headache. He's not the one who has to go days at a time without food because there isn't any vegetation down here. I'm the one doing the work, so I'm the one who should get the reward. The Source will be mine and mine alone.

2, 3, 5, 7, 11, 13, 17, 19, 23, 29`
  },
  {
    id: 13,
    title: "???",
    text: `He lied he lied he lied he lied. Rokudou is a liar. He seeks only to control. He says he wants The Source to save the world, to rid it of the fat cats who play the planet like a marionette. He he he HE is the fat cat, the puppeteer. He shall not have The Source. It shall be mine. Mine mine mine mine mine. 73, 79, 83, 89, 97, 101, 103, 107, 109, 113.

The Source is here. It is down here, in the dark. I can feel its heat, a warmth like the sun against my cheek. But no, I mustn't go to it, not not not not yet. If I find it, Rokudou will take it from me and it will be check check check check mate. No, Kabochanomizu is cautious. Kabochanomizu is careful. I shall retreat to the surface. I know enough now to build things. I will return only when I can guarantee my success. Rokudou will grovel before me and the world will know Kabochanomizu as its savior.`
  },
  {
    id: 14,
    title: "Log Entry - Saturday - Very Cloudy",
    text: `I have to admit that I was surprised when Rokudou selected me to find The Source. True, I have studied the island from afar as much as any other researcher in the world, but slacks and a lab coat are hardly appropriate for rugged terrain. When Rokudou offered me the job I was initially suspicious, but now I see that I am the only man with any chance of success. The island has grown unhindered for a hundred years, and its twisted derivations of reality are the type of thing that could drive a lesser man insane.

Still, I can't say that I completely trust Rokudou. He's a smart man, but I am also sure that he selected me because he thought me easy to control. I get the feeling that he's watching me over my shoulder. Of course, the island is free of human habitation save me and the three adventurers I met a few days ago, so the presence of a spy is unlikely. And yet, I can't shake this feeling of being watched.`
  },
  {
    id: 15,
    title: "Log Entry - The days have run together - Sunny",
    text: `There is something I must confide, even if only to this scrap of notebook paper.

I killed those adventurers. I killed them in their sleep and then hung them from the trees as if to convince myself that the island had somehow done away with them. It was grisly business, but necessary. I needed their supplies, especially the batteries and flashlights they brought. More importantly, against all odds they discovered the entrance to the cave. They must have blundered across it while awkwardly stumbling through the forest--their brains are too small to have calculated its location. The Source is too important to leave to such simpletons, and I couldn't risk the possibility, no matter how remote, that they might find it first.

Am I a monster? I do not think so. I am Dr. Kabochanomizu, widely respected scientist and the world's expert on the inverted Atlantis that is this island. My actions are logical and justified--I am no monster.

If I am honest with myself, there is another reason the adventurers had to die. I wanted to do it. And I enjoyed it.`
  }
];

/**
 * Get a diary entry by ID
 */
export function getDiaryEntry(id: number): DiaryEntry | null {
  return DiaryEntries.find(entry => entry.id === id) ?? null;
}

/**
 * Get diary entry by collected count (1-indexed)
 */
export function getDiaryByCollectionOrder(collectedCount: number): DiaryEntry | null {
  if (collectedCount < 1 || collectedCount > DiaryEntries.length) {
    return null;
  }
  return DiaryEntries[collectedCount - 1];
}
