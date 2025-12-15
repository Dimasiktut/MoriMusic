import { User } from './types';

export const MOCK_USER_ID = 0;

export const GENRES = [
  'Phonk', 'Hip-Hop', 'Electronic', 'Lo-Fi', 'Rock', 'Ambient', 'Techno', 'Pop'
];

export const INITIAL_USER: User = {
  id: 0,
  username: '',
  firstName: '',
  lastName: '',
  photoUrl: '',
  bio: '',
  links: {},
  stats: {
    uploads: 0,
    likesReceived: 0,
    totalPlays: 0,
  },
};

// --- TELEGRAM GROUP CONFIGURATION ---
// ВАЖНО: Вставьте сюда токен от @morimusics_bot (получить у @BotFather)
export const TELEGRAM_BOT_TOKEN = '8597639400:AAGg76KAn5onhXZGLaWQx6jDJbaBah4emBg'; 

// ID канала или группы для проверки подписки
export const TELEGRAM_CHAT_ID = '@clan_mori'; 

// Ссылка, которая откроется, если пользователь не подписан
export const TELEGRAM_GROUP_LINK = 'https://t.me/clan_mori';

// Ссылка на ваше Mini App для генерации Deep Links
// ВАЖНО: Чтобы эта ссылка работала, вы должны создать приложение в BotFather через команду /newapp
// 1. Откройте BotFather
// 2. Напишите /newapp
// 3. Выберите бота
// 4. Введите название и описание
// 5. Когда спросит "Short Name", введите: app
// 6. Введите URL вашего Vercel проекта
export const TELEGRAM_APP_LINK = 'https://t.me/morimusics_bot/app';