# Los-Santos FM - Портал радиоцентра

Современный веб-портал радиоцентра Los-Santos FM с системой управления программами эфиров, обучением и экзаменами.

## 🎯 Возможности

- **Главная страница** с быстрым доступом к основным разделам
- **Программа эфиров** - управление расписанием радиопрограмм
- **Обучение** - материалы для подготовки
- **Экзамены** - система тестирования знаний
- **Информация** - о радиоцентре и станциях
- **Админ-панель** - управление контентом с защитой паролем

## 🚀 Быстрый старт

### Локальная разработка

1. Установите зависимости:
```bash
npm install
```

2. Запустите dev-сервер:
```bash
npm run dev
```

Сайт откроется автоматически на `http://localhost:3000`

### Сборка для продакшена

```bash
npm run build
```

Результат будет в папке `dist/`

### Предпросмотр сборки

```bash
npm run preview
```

## ⚙️ Настройка Supabase

1. Создайте проект на [supabase.com](https://supabase.com)

2. Создайте таблицу для программ эфиров:

```sql
CREATE TABLE radio_programs (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  host TEXT NOT NULL,
  day_of_week TEXT NOT NULL,
  time_start TIME NOT NULL,
  time_end TIME NOT NULL,
  description TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Включите RLS
ALTER TABLE radio_programs ENABLE ROW LEVEL SECURITY;

-- Разрешите чтение всем
CREATE POLICY "Allow public read access"
ON radio_programs FOR SELECT
TO anon
USING (true);

-- Разрешите операции записи для anon (или создайте более строгую политику)
CREATE POLICY "Allow public insert"
ON radio_programs FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow public update"
ON radio_programs FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public delete"
ON radio_programs FOR DELETE
TO anon
USING (true);
```

3. Обновите `src/config.js`:
```javascript
export const supabaseUrl = 'https://your-project.supabase.co';
export const supabaseKey = 'your-anon-key';
```

4. (Опционально) Измените пароль администратора:
```javascript
export const adminPassword = 'your-secure-password';
```

## 📁 Структура проекта

```
lsfmnew/
├── index.html              # Главная страница
├── package.json            # Зависимости
├── vite.config.js          # Конфигурация Vite
├── .github/
│   └── workflows/
│       └── deploy.yml      # CI/CD для GitHub Pages
└── src/
    ├── main.js             # Основная логика приложения
    ├── config.js           # Конфигурация (Supabase, пароли)
    └── styles.css          # Стили
```

## 🎨 Особенности дизайна

- Современный gradient-дизайн
- Адаптивная верстка для мобильных устройств
- Плавные анимации и переходы
- Модальные окна для форм
- Карточный интерфейс для программ эфиров
- Sticky-навигация

## 🔐 Админ-панель

1. Нажмите на кнопку 🔐 в правом нижнем углу
2. Введите пароль (по умолчанию: `lsfm-admin-2026`)
3. После входа станут доступны функции:
   - Добавление новых программ
   - Редактирование программ
   - Удаление программ

## 🌐 Деплой на GitHub Pages

1. Создайте репозиторий на GitHub
2. Загрузите код:
```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/username/repo.git
git push -u origin main
```

3. Включите GitHub Pages в настройках репозитория:
   - Settings → Pages
   - Source: GitHub Actions

4. При каждом push в ветку `main` сайт будет автоматически обновляться

## 🛠 Технологии

- **Vite** - быстрая сборка и dev-сервер
- **Vanilla JavaScript** - без фреймворков
- **Supabase** - backend и база данных
- **CSS3** - градиенты, анимации, grid/flexbox
- **GitHub Actions** - автоматический деплой

## 📝 Дальнейшее развитие

Идеи для расширения:

- [ ] Добавить таблицы для обучающих материалов
- [ ] Реализовать систему экзаменов с вопросами из БД
- [ ] Добавить загрузку изображений для программ
- [ ] Создать статистику прослушиваний
- [ ] Добавить календарь эфиров
- [ ] Интегрировать плеер для прослушивания радио
- [ ] Добавить систему уведомлений о начале эфира
- [ ] Реализовать личные кабинеты для ведущих

## 📄 Лицензия

MIT

## 👥 Автор

Проект создан для радиоцентра Los-Santos FM
