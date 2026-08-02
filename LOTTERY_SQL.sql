-- =============================================
-- LOTTERY SYSTEM - Supabase SQL Setup
-- Выполнить в SQL Editor на Supabase
-- =============================================

-- Создание таблицы розыгрышей
CREATE TABLE IF NOT EXISTS lottery_draws (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    week_title TEXT NOT NULL,
    grand_final_winner_1 TEXT,
    grand_final_winner_2 TEXT,
    basic_league_winner TEXT,
    participants_data JSONB DEFAULT '{}'::jsonb,
    slug TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Индекс для быстрого поиска по slug
CREATE INDEX IF NOT EXISTS idx_lottery_draws_slug ON lottery_draws(slug);

-- Индекс для сортировки по дате
CREATE INDEX IF NOT EXISTS idx_lottery_draws_created_at ON lottery_draws(created_at DESC);

-- Включить Row Level Security
ALTER TABLE lottery_draws ENABLE ROW LEVEL SECURITY;

-- Политика: все могут читать (публичная страница результатов)
CREATE POLICY "Public can read lottery draws"
    ON lottery_draws
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Политика: все могут вставлять (админ через anon key)
CREATE POLICY "Anyone can insert lottery draws"
    ON lottery_draws
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Политика: все могут обновлять (если понадобится)
CREATE POLICY "Anyone can update lottery draws"
    ON lottery_draws
    FOR UPDATE
    TO anon, authenticated
    USING (true);

-- Политика: все могут удалять (если понадобится)
CREATE POLICY "Anyone can delete lottery draws"
    ON lottery_draws
    FOR DELETE
    TO anon, authenticated
    USING (true);

-- Пример данных для теста (опционально)
-- INSERT INTO lottery_draws (week_title, grand_final_winner_1, grand_final_winner_2, basic_league_winner, participants_data, slug)
-- VALUES (
--     'Неделя 1: 03.08 - 10.08',
--     'Игрок Альфа',
--     'Игрок Бета',
--     'Игрок Гамма',
--     '{
--         "grandFinal": [
--             {"name": "Игрок Альфа", "tickets": 10},
--             {"name": "Игрок Бета", "tickets": 7},
--             {"name": "Игрок Дельта", "tickets": 3}
--         ],
--         "basicLeague": [
--             {"name": "Игрок Гамма", "tickets": 5},
--             {"name": "Игрок Эпсилон", "tickets": 4}
--         ]
--     }'::jsonb,
--     'week-1-03-08-10-08'
-- );
