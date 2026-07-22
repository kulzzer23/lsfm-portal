# Настройка Supabase для Los-Santos FM Portal

Полная инструкция по настройке базы данных для портала с системой авторов и архивом эфиров.

## 1. Создание проекта

1. Зарегистрируйтесь или войдите на [supabase.com](https://supabase.com)
2. Создайте новый проект
3. Сохраните URL проекта и анонимный ключ (anon key)

## 2. Создание таблиц

### Таблица авторов программ (program_authors)

```sql
-- Создание таблицы авторов
CREATE TABLE program_authors (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Включение RLS
ALTER TABLE program_authors ENABLE ROW LEVEL SECURITY;

-- Политики доступа
CREATE POLICY "Allow public read authors"
ON program_authors FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow public insert authors"
ON program_authors FOR INSERT
TO anon
WITH CHECK (true);
```

### Таблица программ эфиров (radio_programs)

```sql
-- Создание таблицы программ
CREATE TABLE radio_programs (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  full_description TEXT,
  image_url TEXT,
  author_id BIGINT REFERENCES program_authors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Включение RLS
ALTER TABLE radio_programs ENABLE ROW LEVEL SECURITY;

-- Политики доступа
CREATE POLICY "Allow public read programs"
ON radio_programs FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow public insert programs"
ON radio_programs FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow public update programs"
ON radio_programs FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public delete programs"
ON radio_programs FOR DELETE
TO anon
USING (true);

-- Триггер для обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_radio_programs_updated_at
    BEFORE UPDATE ON radio_programs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Таблица архива эфиров (broadcast_archive)

```sql
-- Создание таблицы архива эфиров
CREATE TABLE broadcast_archive (
  id BIGSERIAL PRIMARY KEY,
  program_id BIGINT REFERENCES radio_programs(id) ON DELETE CASCADE,
  broadcast_date TIMESTAMPTZ NOT NULL,
  content TEXT NOT NULL,
  link_url TEXT,
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Включение RLS
ALTER TABLE broadcast_archive ENABLE ROW LEVEL SECURITY;

-- Политики доступа
CREATE POLICY "Allow public read broadcasts"
ON broadcast_archive FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow public insert broadcasts"
ON broadcast_archive FOR INSERT
TO anon
WITH CHECK (true);

CREATE POLICY "Allow public update broadcasts"
ON broadcast_archive FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public delete broadcasts"
ON broadcast_archive FOR DELETE
TO anon
USING (true);

-- Триггер для обновления updated_at
CREATE TRIGGER update_broadcast_archive_updated_at
    BEFORE UPDATE ON broadcast_archive
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Индекс для быстрого поиска по программе
CREATE INDEX idx_broadcast_program_id ON broadcast_archive(program_id);
CREATE INDEX idx_broadcast_date ON broadcast_archive(broadcast_date DESC);
```

### (Опционально) Таблица обучающих материалов

```sql
CREATE TABLE learning_content (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE learning_content ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read learning"
ON learning_content FOR SELECT
TO anon
USING (true);

CREATE POLICY "Allow public write learning"
ON learning_content FOR ALL
TO anon
USING (true)
WITH CHECK (true);
```

## 3. Добавление тестовых данных

```sql
-- Создать автора
INSERT INTO program_authors (name) VALUES
('John_Smith'),
('Sarah_Johnson');

-- Получить ID авторов
SELECT id, name FROM program_authors;

-- Создать программу (замените author_id на реальный ID)
INSERT INTO radio_programs (title, description, full_description, author_id) VALUES
('Утреннее шоу', 
 'Начните свой день с отличной музыки!',
 '<h2>О программе</h2><p>Каждое утро мы радуем вас лучшей музыкой и позитивными новостями!</p><h2>Формат</h2><p>Музыка, новости, интервью с гостями.</p>',
 1); -- Замените на реальный ID автора

-- Добавить запись в архив (замените program_id на реальный ID)
INSERT INTO broadcast_archive (program_id, broadcast_date, content, link_url) VALUES
(1, NOW(), '<p>Сегодня в эфире обсудили последние новости и сыграли хиты недели!</p><ul><li>Новости дня</li><li>Топ-10 хитов</li><li>Интервью с местным артистом</li></ul>', 'https://youtube.com/example');
```

## 4. Настройка конфигурации в проекте

Откройте `src/config.js` и обновите параметры:

```javascript
// Supabase Configuration
export const supabaseUrl = 'https://your-project-id.supabase.co';
export const supabaseKey = 'your-anon-key-here';

// Tables
export const TABLES = {
    programs: 'radio_programs',
    authors: 'program_authors',
    broadcasts: 'broadcast_archive',
    learning: 'learning_content'
};

// Local storage keys
export const STORAGE_KEYS = {
    authorId: 'lsfm_author_id',
    authorName: 'lsfm_author_name'
};
```

## 5. Где найти ключи Supabase

1. Откройте ваш проект в Supabase Dashboard
2. Перейдите в Settings → API
3. Найдите:
   - **Project URL** - это ваш `supabaseUrl`
   - **anon public** key - это ваш `supabaseKey`

## 6. Функционал системы

### Для авторов:

1. **Вход/Регистрация**: Автор вводит свой игровой ник
2. **Создание программы**: Каждый автор может создать одну программу
3. **Редактирование описания**: HTML редактор для полного описания программы
4. **Добавление изображения**: URL изображения программы
5. **Архив эфиров**: Добавление записей о каждом эфире с:
   - Датой и временем
   - Описанием (HTML)
   - Ссылкой на запись
   - Изображением

### Для посетителей:

1. Просмотр всех программ
2. Детальная страница каждой программы
3. Просмотр архива эфиров

## 7. Структура данных

### program_authors
- `id` - Уникальный идентификатор автора
- `name` - Игровой ник (уникальный)
- `created_at` - Дата регистрации

### radio_programs
- `id` - ID программы
- `title` - Название программы
- `description` - Краткое описание
- `full_description` - Полное описание (HTML)
- `image_url` - Изображение программы
- `author_id` - Ссылка на автора
- `created_at` / `updated_at` - Даты

### broadcast_archive
- `id` - ID записи
- `program_id` - Ссылка на программу
- `broadcast_date` - Дата эфира
- `content` - Описание эфира (HTML)
- `link_url` - Ссылка на запись (YouTube, SoundCloud и т.д.)
- `image_url` - Изображение эфира
- `created_at` / `updated_at` - Даты

## 8. Безопасность для продакшена

⚠️ **Важно**: Текущие политики разрешают всем анонимным пользователям редактировать данные!

Для продакшена рекомендуется:

### Вариант 1: Аутентификация через Supabase Auth

```sql
-- Удалить открытые политики
DROP POLICY IF EXISTS "Allow public insert programs" ON radio_programs;
DROP POLICY IF EXISTS "Allow public update programs" ON radio_programs;
DROP POLICY IF EXISTS "Allow public delete programs" ON radio_programs;

-- Создать политики с проверкой владельца
CREATE POLICY "Authors can insert own programs"
ON radio_programs FOR INSERT
TO authenticated
WITH CHECK (auth.uid()::text = author_id::text);

CREATE POLICY "Authors can update own programs"
ON radio_programs FOR UPDATE
TO authenticated
USING (auth.uid()::text = author_id::text)
WITH CHECK (auth.uid()::text = author_id::text);

CREATE POLICY "Authors can delete own programs"
ON radio_programs FOR DELETE
TO authenticated
USING (auth.uid()::text = author_id::text);
```

### Вариант 2: Проверка по имени автора (проще, но менее безопасно)

Добавить поле `author_secret` в `program_authors` с паролем/токеном:

```sql
ALTER TABLE program_authors ADD COLUMN author_secret TEXT;

-- Обновить политики для проверки секрета
-- (требует изменения в клиентском коде для передачи секрета)
```

### Вариант 3: Edge Functions (рекомендуется для сложной логики)

Создать Supabase Edge Function для валидации операций.

## 9. Ограничения (опционально)

### Один автор = одна программа

```sql
-- Добавить уникальный constraint
ALTER TABLE radio_programs ADD CONSTRAINT unique_author_program UNIQUE (author_id);
```

### Ограничить количество эфиров

```sql
-- Функция для проверки лимита
CREATE OR REPLACE FUNCTION check_broadcast_limit()
RETURNS TRIGGER AS $$
DECLARE
    broadcast_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO broadcast_count
    FROM broadcast_archive
    WHERE program_id = NEW.program_id;
    
    IF broadcast_count >= 100 THEN
        RAISE EXCEPTION 'Превышен лимит записей эфиров (100)';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER check_broadcast_limit_trigger
    BEFORE INSERT ON broadcast_archive
    FOR EACH ROW
    EXECUTE FUNCTION check_broadcast_limit();
```

## 10. Проверка работоспособности

1. Запустите проект: `npm run dev`
2. Откройте `http://localhost:3000`
3. Нажмите на иконку 👤 в правом нижнем углу
4. Войдите как автор (любой ник)
5. Создайте программу
6. Добавьте описание и изображение
7. Добавьте запись в архив эфиров
8. Проверьте отображение на главной странице

## 11. Решение проблем

### Ошибка "relation does not exist"
- Убедитесь, что таблица создана в схеме `public`
- Проверьте имена таблиц в SQL и config.js

### Ошибка "permission denied"
- Проверьте что RLS включен
- Убедитесь что политики созданы правильно
- Проверьте что используете правильный anon key

### Не загружаются программы
- Откройте консоль браузера (F12)
- Проверьте ошибки в Network и Console
- Убедитесь что URL и ключ правильные в config.js

### Автор не может создать программу
- Проверьте что автор создан в таблице `program_authors`
- Убедитесь что `author_id` корректно сохраняется

## 12. Дополнительные возможности

### Storage для изображений

Вместо URL можно использовать Supabase Storage:

1. Создайте bucket `program-images` в Supabase Dashboard
2. Включите публичный доступ для чтения
3. Добавьте код загрузки в приложение:

```javascript
// Пример загрузки изображения
const uploadImage = async (file) => {
    const fileName = `${Date.now()}_${file.name}`;
    const { data, error } = await supabase.storage
        .from('program-images')
        .upload(fileName, file);
    
    if (error) throw error;
    
    const { data: { publicUrl } } = supabase.storage
        .from('program-images')
        .getPublicUrl(fileName);
    
    return publicUrl;
};
```

### Уведомления о новых эфирах

Можно добавить Supabase Realtime для live-обновлений:

```javascript
// Подписка на изменения
const subscription = supabase
    .channel('broadcast_changes')
    .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'broadcast_archive' },
        (payload) => {
            console.log('Новый эфир!', payload.new);
            // Обновить UI
        }
    )
    .subscribe();
```

---

**Готово!** Теперь ваш портал Los-Santos FM полностью настроен с системой авторов и архивом эфиров!
