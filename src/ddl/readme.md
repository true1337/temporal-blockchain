# DDL файлы для ClickHouse

Эта папка содержит SQL DDL файлы для создания таблиц в ClickHouse.

## Файлы:

- `transactions.sql` - Таблица для сырых данных транзакций USDC Transfer
- `analytics-examples.sql` - Примеры SQL запросов для аналитики на основе таблицы `usdc_transactions`

## Использование:

DDL файлы читаются автоматически при создании таблиц через activities. Аналитика выполняется напрямую через SQL запросы к таблице `usdc_transactions`.

