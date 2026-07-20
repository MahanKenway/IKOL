import { Composer } from 'grammy';
import { getLogger } from '../../services/logger/index.js';

const logger = getLogger({ module: 'fun-calendar' });
const bot = new Composer();

// Fun days and events database
const FUN_DAYS: Record<string, { name: string; emoji: string; description: string }[]> = {
  '01': [
    { name: 'New Year\'s Day', emoji: '🎉', description: 'The first day of the year!' },
    { name: 'National Hangover Day', emoji: '🤕', description: 'Recover from NYE celebrations' },
  ],
  '02': [
    { name: 'National Science Fiction Day', emoji: '🚀', description: 'Celebrating sci-fi and imagination' },
  ],
  '04': [
    { name: 'World Braille Day', emoji: '⠿', description: 'Celebrating Louis Braille\'s birthday' },
  ],
  '08': [
    { name: 'National Bubble Bath Day', emoji: '🛁', description: 'Time to relax!' },
  ],
  '13': [
    { name: 'National Comedy Day', emoji: '😂', description: 'Laugh out loud!' },
  ],
  '14': [
    { name: 'National Dress Up Day', emoji: '👗', description: 'Express yourself!' },
  ],
  '15': [
    { name: 'National Hat Day', emoji: '🎩', description: 'Rock your favorite hat' },
  ],
  '18': [
    { name: 'National Winnie the Pooh Day', emoji: '🍯', description: 'Oh bother!' },
  ],
  '22': [
    { name: 'National Hot Sauce Day', emoji: '🌶️', description: 'Bring the heat!' },
  ],
  '24': [
    { name: 'National Compliment Day', emoji: '💝', description: 'Spread kindness!' },
  ],
  '26': [
    { name: 'National Spouses Day', emoji: '💑', description: 'Celebrate your partner' },
  ],
  '27': [
    { name: 'National Chocolate Cake Day', emoji: '🎂', description: 'Indulge in chocolate cake' },
  ],
};

// Tech/Gaming days
const TECH_DAYS: Record<string, { name: string; emoji: string }[]> = {
  '02-14': [{ name: 'Valentine\'s Day (Gamer Edition)', emoji: '💝🎮' }],
  '03-14': [{ name: 'Pi Day', emoji: '🥧' }],
  '04-01': [{ name: 'April Fools\' Day', emoji: '🤡' }],
  '04-22': [{ name: 'Earth Day', emoji: '🌍' }],
  '05-04': [{ name: 'Star Wars Day', emoji: '⭐' }],
  '06-08': [{ name: 'World Oceans Day', emoji: '🌊' }],
  '07-30': [{ name: 'International Day of Friendship', emoji: '🤝' }],
  '08-12': [{ name: 'International Youth Day', emoji: '🧒' }],
  '09-01': [{ name: 'Programmers Day', emoji: '👨‍💻' }],
  '09-19': [{ name: 'International Talk Like a Pirate Day', emoji: '🏴‍☠️' }],
  '10-10': [{ name: 'World Mental Health Day', emoji: '🧠' }],
  '10-21': [{ name: 'International Day of the Air Traffic Controller', emoji: '✈️' }],
  '10-31': [{ name: 'Halloween', emoji: '🎃' }],
  '11-01': [{ name: 'World Vegan Day', emoji: '🌱' }],
  '11-11': [{ name: 'Singles\' Day', emoji: '1️⃣' }],
  '11-19': [{ name: 'World Toilet Day', emoji: '🚽' }],
  '11-26': [{ name: 'International Day of Cinema', emoji: '🎬' }],
  '12-01': [{ name: 'World AIDS Day', emoji: ' ribbon' }],
  '12-08': [{ name: 'International Computer Security Day', emoji: '🔒' }],
  '12-21': [{ name: 'Winter Solstice', emoji: '❄️' }],
  '12-25': [{ name: 'Christmas Day', emoji: '🎄' }],
  '12-31': [{ name: 'New Year\'s Eve', emoji: '🎆' }],
};

// /today command
bot.command('today', async (ctx) => {
  const today = new Date();
  const day = today.getDate().toString().padStart(2, '0');
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const monthDay = `${month}-${day}`;
  
  const dayEvents = FUN_DAYS[day] || [];
  const techEvents = TECH_DAYS[monthDay] || [];
  
  let message = `📅 **Today is ${today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}**\n\n`;
  
  if (techEvents.length > 0) {
    message += '**🎉 Special Days:**\n';
    techEvents.forEach(event => {
      message += `${event.emoji} ${event.name}\n`;
    });
    message += '\n';
  }
  
  if (dayEvents.length > 0) {
    message += '**🎉 Fun Days:**\n';
    dayEvents.forEach(event => {
      message += `${event.emoji} ${event.name}\n`;
      message += `   _${event.description}_\n`;
    });
    message += '\n';
  }
  
  if (dayEvents.length === 0 && techEvents.length === 0) {
    message += '_No special days today... but every day is a good day!_ 🌟';
  }
  
  await ctx.reply(message, { parse_mode: 'Markdown' });
});

// /randomfact command
bot.command('randomfact', async (ctx) => {
  const facts = [
    '🐙 An octopus has three hearts, nine brains, and blue blood.',
    '🍯 Honey never spoils. Archaeologists found 3,000-year-old honey in Egyptian tombs that was still edible.',
    '闪电 The surface of the Sun is about 5,500°C (9,932°F).',
    '🦒 A giraffe\'s tongue is about 45 cm (18 inches) long and dark purple.',
    '🦩 Flamingos can only eat with their heads upside down.',
    '🌍 There are more trees on Earth than stars in the Milky Way.',
    '🎹 The human eye can distinguish about 10 million different colors.',
    '🐙 Octopuses have blue blood.',
    '🐜 Ants can carry objects 50 times their own body weight.',
    '🐬 Dolphins sleep with one eye open.',
    '🦜 Parrots can learn over 100 words.',
    '🐧 Penguins propose with pebbles.',
    '🦥 Sloths can hold their breath longer than dolphins.',
    '🐄 Cows have best friends.',
    '🦊 Foxes use the Earth\'s magnetic field to hunt.',
    '🦈 Sharks are older than trees.',
    '🦑 The giant squid has the largest eyes of any animal.',
    '🐝 Bees can recognize human faces.',
    '🦘 Kangaroos can\'t walk backward.',
    '🦉 Owls can rotate their heads 270 degrees.',
  ];
  
  const randomFact = facts[Math.floor(Math.random() * facts.length)];
  await ctx.reply(`🧠 **Random Fact**\n\n${randomFact}`, { parse_mode: 'Markdown' });
});

// /quote command
bot.command('quote', async (ctx) => {
  const quotes = [
    { text: 'The only way to do great work is to love what you do.', author: 'Steve Jobs' },
    { text: 'Innovation distinguishes between a leader and a follower.', author: 'Steve Jobs' },
    { text: 'Life is what happens when you\'re busy making other plans.', author: 'John Lennon' },
    { text: 'The future belongs to those who believe in the beauty of their dreams.', author: 'Eleanor Roosevelt' },
    { text: 'It is during our darkest moments that we must focus to see the light.', author: 'Aristotle' },
    { text: 'The best time to plant a tree was 20 years ago. The second best time is now.', author: 'Chinese Proverb' },
    { text: 'Your time is limited, don\'t waste it living someone else\'s life.', author: 'Steve Jobs' },
    { text: 'If you look at what you have in life, you\'ll always have more.', author: 'Oprah Winfrey' },
    { text: 'If you set your goals ridiculously high and it\'s a failure, you will fail above everyone else\'s success.', author: 'James Cameron' },
    { text: 'Success is not final, failure is not fatal: it is the courage to continue that counts.', author: 'Winston Churchill' },
  ];
  
  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  await ctx.reply(
    `💬 **Quote of the Moment**\n\n` +
    `_${randomQuote.text}_\n\n` +
    `— **${randomQuote.author}**`,
    { parse_mode: 'Markdown' }
  );
});

export default bot;
